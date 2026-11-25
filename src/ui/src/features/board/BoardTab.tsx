import {
  applyNodeChanges,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type AriaLabelConfig,
  type Connection,
  type EdgeTypes,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { request } from "../../bridge/core";
import type {
  Board,
  BoardPosition,
  ElementKind,
  Relationship,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { KIND_NAMES, KINDS, suggestedAttributes } from "../elements/kinds";
import { UndoNotice } from "../outline/UndoNotice";
import { arrange } from "./arrange";
import { BoardSearch } from "./BoardSearch";
import { OpenElementSheet } from "../elements/OpenElementSheet";
import { changeRelationship, relate, type KindChoice } from "../elements/relate";
import { RelationshipPicker } from "../elements/RelationshipPicker";
import { arrowsFor } from "./edges";
import { ElementCard } from "./ElementCard";
import { cardsFor, type CardNode } from "./nodes";
import { CARD, freePlaceNear } from "./placement";
import { RelationArrow } from "./RelationArrow";
import "./board.css";

export interface BoardTabProps {
  board: Board;
  loaded: boolean;
  origin: string;
  chooseImage(): Promise<string | null>;
}

/** How long the board waits after a card stops moving before it keeps where it is. */
export const MOVE_DELAY_MS = 250;

const nodeTypes: NodeTypes = { card: ElementCard };
const edgeTypes: EdgeTypes = { relation: RelationArrow };
const arrowHead = { type: MarkerType.ArrowClosed, width: 14, height: 14 };

/** The card under the point where a drag let go, if any. */
function cardAt(event: globalThis.MouseEvent | TouchEvent): string | null {
  const point = "changedTouches" in event ? event.changedTouches[0] : event;
  if (!point) return null;
  const under = window.document.elementFromPoint(point.clientX, point.clientY);
  return under?.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? null;
}

/** What the relationship picker is open for: two cards just joined, or an arrow there is. */
type Picking =
  { kind: "new"; from: string; to: string } | { kind: "change"; relationship: Relationship };

/** What React Flow says to screen readers, in Spanish. */
const ariaLabels: Partial<AriaLabelConfig> = {
  "node.a11yDescription.default":
    "Intro abre la ficha. Las flechas mueven la tarjeta seleccionada.",
  "node.a11yDescription.keyboardDisabled": "Intro abre la ficha.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
    `Tarjeta movida hacia ${direction}, a ${Math.round(x)}, ${Math.round(y)}.`,
  "edge.a11yDescription.default": "Intro cambia o quita la relación.",
  "controls.ariaLabel": "Vista de la pizarra",
};

/** The board of the work: the fichas as cards placed where the writer wants. Loaded the first time it opens. */
export default function BoardTab(props: BoardTabProps) {
  return (
    <ReactFlowProvider>
      <BoardCanvas {...props} />
    </ReactFlowProvider>
  );
}

function BoardCanvas({ board, loaded, origin, chooseImage }: BoardTabProps) {
  const flow = useReactFlow<CardNode>();
  const [nodes, setNodes] = useState<CardNode[]>(() => cardsFor(board.elements, []));
  const [synced, setSynced] = useState(board.elements);
  const [openId, setOpenId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  // The kinds the writer chose not to see, with their cards and arrows.
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ElementKind>>(() => new Set());
  // Where the cards were before arranging them, while the writer can still take it back.
  const [before, setBefore] = useState<{
    at: number;
    positions: Map<string, BoardPosition>;
  } | null>(null);

  // What any window does to the elements shows on the cards.
  if (synced !== board.elements) {
    setSynced(board.elements);
    setNodes((previous) => cardsFor(board.elements, previous));
  }

  // Cards that stopped moving wait a moment, so a run of arrow keys is kept in one go.
  const latest = useRef({ nodes, board, origin });
  useEffect(() => {
    latest.current = { nodes, board, origin };
  });
  const moved = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);

  const keepMoves = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const ids = moved.current;
    if (ids.size === 0) return;
    moved.current = new Set();
    const positions = latest.current.nodes
      .filter((node) => ids.has(node.id))
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
    if (positions.length === 0) return;
    request("board.move", { positions, origin: latest.current.origin }).then(
      () => setProblem(null),
      (error: unknown) => {
        setProblem(messageFor(error));
        // The cards go back to where the work has them.
        setNodes(cardsFor(latest.current.board.elements, []));
      },
    );
  }, []);

  useEffect(() => keepMoves, [keepMoves]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
      let stopped = false;
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          moved.current.add(change.id);
          stopped = true;
        }
      }
      if (stopped) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(keepMoves, MOVE_DELAY_MS);
      }
    },
    [keepMoves],
  );

  const editArrow = useCallback(
    (id: string) => {
      const relationship = board.relationships.find((candidate) => candidate.id === id);
      if (relationship) setPicking({ kind: "change", relationship });
    },
    [board.relationships],
  );

  // One card chosen: it, its arrows and its neighbours stay clear; the rest steps back.
  const chosen = nodes.filter((node) => node.selected);
  const chosenId = chosen.length === 1 ? chosen[0]!.id : null;
  const near = useMemo(() => {
    if (chosenId === null) return null;
    const id = chosenId;
    const set = new Set([id]);
    for (const relationship of board.relationships) {
      if (relationship.from === id) set.add(relationship.to);
      if (relationship.to === id) set.add(relationship.from);
    }
    return { id, set };
  }, [chosenId, board.relationships]);

  const shownNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        hidden: hiddenKinds.has(node.data.element.kind),
        className: near && !near.set.has(node.id) ? "board-faded" : undefined,
      })),
    [nodes, hiddenKinds, near],
  );

  const edges = useMemo(() => {
    const kindOf = new Map(board.elements.map((element) => [element.id, element.kind]));
    const hides = (id: string) => hiddenKinds.has(kindOf.get(id) ?? "other");
    return arrowsFor(board.relationships, board.elements, board.ownKinds).map((arrow) => ({
      ...arrow,
      // An arrow goes with the cards it joins.
      hidden: hides(arrow.source) || hides(arrow.target),
      markerEnd: arrowHead,
      selected: picking?.kind === "change" && picking.relationship.id === arrow.id,
      className:
        near && arrow.source !== near.id && arrow.target !== near.id ? "board-faded" : undefined,
      data: arrow.data && { ...arrow.data, onEdit: () => editArrow(arrow.id) },
    }));
  }, [board.relationships, board.elements, board.ownKinds, picking, editArrow, near, hiddenKinds]);

  function toggleKind(kind: ElementKind) {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  /** Takes the view to a card, shows its kind if it was hidden, and leaves it chosen with the keyboard on it. */
  function find(id: string) {
    const element = board.elements.find((candidate) => candidate.id === id);
    if (!element) return;
    setHiddenKinds((current) => {
      if (!current.has(element.kind)) return current;
      const next = new Set(current);
      next.delete(element.kind);
      return next;
    });
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
    void flow.setCenter(element.position.x + CARD.width / 2, element.position.y + CARD.height / 2, {
      zoom: Math.max(flow.getZoom(), 1),
      duration: 300,
    });
    window.setTimeout(
      () =>
        window.document
          .querySelector<HTMLElement>(`.board-tab .react-flow__node[data-id="${id}"]`)
          ?.focus({ preventScroll: true }),
      0,
    );
  }

  async function moveAll(positions: Map<string, BoardPosition>) {
    await request("board.move", {
      positions: [...positions].map(([id, { x, y }]) => ({ id, x, y })),
      origin,
    });
    // The cards come back with the change; then the view takes them all in.
    window.setTimeout(() => void flow.fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 50);
  }

  async function arrangeAll() {
    if (board.elements.length < 2) return;
    const previous = new Map(board.elements.map((element) => [element.id, element.position]));
    try {
      await moveAll(arrange(board.elements, board.relationships));
      setBefore({ at: Date.now(), positions: previous });
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function undoArrange() {
    const previous = before;
    setBefore(null);
    if (!previous) return;
    // Cards that left the board meanwhile are left out.
    const still = new Map(
      [...previous.positions].filter(([id]) => board.elements.some((element) => element.id === id)),
    );
    if (still.size === 0) return;
    try {
      await moveAll(still);
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  const dismissUndo = useCallback(() => setBefore(null), []);

  function join(from: string, to: string) {
    if (from === to) return;
    setPicking({ kind: "new", from, to });
  }

  // Letting go anywhere on another card joins them: React Flow alone only knows its handles.
  function onConnectEnd(event: globalThis.MouseEvent | TouchEvent, state: FinalConnectionState) {
    if (state.isValid || !state.fromNode) return;
    const to = cardAt(event);
    if (to) join(state.fromNode.id, to);
  }

  async function choose(choice: KindChoice) {
    const now = picking;
    setPicking(null);
    if (!now) return;
    try {
      if (now.kind === "new") await relate(now.from, now.to, choice, origin);
      else await changeRelationship(now.relationship, choice, origin);
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  function removeArrow(relationship: Relationship) {
    setPicking(null);
    request("relationship.delete", { id: relationship.id, origin }).then(
      () => setProblem(null),
      (error: unknown) => setProblem(messageFor(error)),
    );
  }

  const named = (id: string) => board.elements.find((element) => element.id === id);
  const sides =
    picking?.kind === "new"
      ? { from: named(picking.from), to: named(picking.to) }
      : picking
        ? { from: named(picking.relationship.from), to: named(picking.relationship.to) }
        : null;

  function open(id: string) {
    setOpenId(id);
    setFreshId(null);
  }

  async function create() {
    const pane = window.document.querySelector(".board-tab .react-flow");
    const box = pane?.getBoundingClientRect();
    const middle = box
      ? flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      : { x: 0, y: 0 };
    const position = freePlaceNear(
      { x: middle.x - CARD.width / 2, y: middle.y - CARD.height / 2 },
      board.elements,
    );
    try {
      const created = await request("element.create", {
        kind: "character",
        name: "Ficha nueva",
        attributes: suggestedAttributes("character"),
        position,
        origin,
      });
      setOpenId(created.id);
      setFreshId(created.id);
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  // A ficha that went to the trash, here or in another window, closes.
  const shownId = openId && board.elements.some((element) => element.id === openId) ? openId : null;

  function close() {
    const id = shownId;
    setOpenId(null);
    // The keyboard goes back to the card it came from.
    if (id)
      window.document
        .querySelector<HTMLElement>(`.board-tab .react-flow__node[data-id="${id}"]`)
        ?.focus();
  }

  return (
    <div className={`board-tab${shownId ? " board-tab-sheet" : ""}`}>
      {loaded && (
        <ReactFlow
          nodes={shownNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onConnect={(connection: Connection) => join(connection.source, connection.target)}
          onConnectEnd={onConnectEnd}
          onEdgeClick={(_: MouseEvent, edge: { id: string }) => editArrow(edge.id)}
          onNodesChange={onNodesChange}
          onNodeDoubleClick={(_: MouseEvent, node: CardNode) => open(node.id)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
            const arrow = (event.target as Element).closest<SVGElement>(".react-flow__edge");
            if (arrow?.dataset.id) {
              event.preventDefault();
              editArrow(arrow.dataset.id);
              return;
            }
            const card = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
            const id = card?.dataset.id;
            if (!id) return;
            event.preventDefault();
            open(id);
          }}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={null}
          onlyRenderVisibleElements
          ariaLabelConfig={ariaLabels}
        >
          <Panel position="top-left" className="board-tools board-tools-top">
            <button type="button" className="action action-main" onClick={() => void create()}>
              Nueva ficha
            </button>
            <BoardSearch elements={board.elements} onFind={find} />
            <button
              type="button"
              className="action"
              disabled={board.elements.length < 2}
              title="Reparte las tarjetas según sus relaciones. Se puede deshacer."
              onClick={() => void arrangeAll()}
            >
              Ordenar
            </button>
            <div className="board-kinds" role="group" aria-label="Tipos que se ven">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="board-kind small-caps"
                  aria-pressed={!hiddenKinds.has(kind)}
                  onClick={() => toggleKind(kind)}
                >
                  {KIND_NAMES[kind].group}
                </button>
              ))}
            </div>
          </Panel>
          <Panel position="bottom-left" className="board-tools" aria-label="Vista de la pizarra">
            <button
              type="button"
              className="action"
              onClick={() => void flow.zoomIn()}
              aria-label="Acercar"
            >
              +
            </button>
            <button
              type="button"
              className="action"
              onClick={() => void flow.zoomOut()}
              aria-label="Alejar"
            >
              −
            </button>
            <button
              type="button"
              className="action"
              onClick={() => void flow.fitView({ padding: 0.2, maxZoom: 1, duration: 200 })}
            >
              Encajar todo
            </button>
          </Panel>
        </ReactFlow>
      )}

      {problem && (
        <p className="board-problem" role="alert">
          {problem}
        </p>
      )}
      {loaded && board.elements.length === 0 && (
        <p className="board-empty">
          Aún no hay fichas. Crea una con «Nueva ficha» o desde el texto, y aparecerá aquí como
          tarjeta.
        </p>
      )}

      {shownId && (
        <aside
          className="sheet board-sheet"
          aria-label="Ficha"
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            if ((event.target as HTMLElement).closest("[data-own-keys]")) return;
            event.preventDefault();
            close();
          }}
        >
          <header className="sheet-header small-caps">
            <h2 className="sheet-title">Ficha</h2>
            <button type="button" className="action" onClick={close} title="Cerrar (Esc)">
              Cerrar
            </button>
          </header>
          <OpenElementSheet
            id={shownId}
            field={freshId === shownId ? "name" : null}
            board={board}
            origin={origin}
            chooseImage={chooseImage}
            onOpen={open}
            onProblem={setProblem}
          />
        </aside>
      )}
      {before && (
        <UndoNotice
          key={before.at}
          message="Tarjetas ordenadas."
          onUndo={() => void undoArrange()}
          onDismiss={dismissUndo}
        />
      )}
      {picking && sides?.from && sides.to && (
        <RelationshipPicker
          from={sides.from}
          to={sides.to}
          relationships={board.relationships}
          ownKinds={board.ownKinds}
          changing={picking.kind === "change" ? picking.relationship : undefined}
          onChoose={(choice) => void choose(choice)}
          onCancel={() => setPicking(null)}
          onRemove={picking.kind === "change" ? () => removeArrow(picking.relationship) : undefined}
        />
      )}
    </div>
  );
}
