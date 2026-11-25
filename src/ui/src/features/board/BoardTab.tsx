import {
  applyNodeChanges,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type AriaLabelConfig,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { request } from "../../bridge/core";
import type { Board } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { suggestedAttributes } from "../elements/kinds";
import { OpenElementSheet } from "../elements/OpenElementSheet";
import { ElementCard } from "./ElementCard";
import { cardsFor, type CardNode } from "./nodes";
import { CARD, freePlaceNear } from "./placement";
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

/** What React Flow says to screen readers, in Spanish. */
const ariaLabels: Partial<AriaLabelConfig> = {
  "node.a11yDescription.default":
    "Intro abre la ficha. Las flechas mueven la tarjeta seleccionada.",
  "node.a11yDescription.keyboardDisabled": "Intro abre la ficha.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) =>
    `Tarjeta movida hacia ${direction}, a ${Math.round(x)}, ${Math.round(y)}.`,
  "edge.a11yDescription.default": "Relación entre dos fichas.",
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
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDoubleClick={(_: MouseEvent, node: CardNode) => open(node.id)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
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
          nodesConnectable={false}
          onlyRenderVisibleElements
          ariaLabelConfig={ariaLabels}
        >
          <Panel position="top-left" className="board-tools">
            <button type="button" className="action action-main" onClick={() => void create()}>
              Nueva ficha
            </button>
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
            others={board.elements}
            origin={origin}
            chooseImage={chooseImage}
            onOpen={open}
            onProblem={setProblem}
          />
        </aside>
      )}
    </div>
  );
}
