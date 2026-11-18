import { CoreError } from "../bridge/core";
import { ErrorCodes, type ErrorReason } from "../bridge/generated/protocol";

/**
 * What the writer reads when something goes wrong: in Spanish, in plain words, and saying what
 * to do when there is something to do. The record lists every reason in the contract, so a new
 * reason does not compile until it has its message.
 */
export const messages: Record<ErrorReason, string> = {
  projectNotOpen: "No hay ningún proyecto abierto.",
  titleRequired: "Escribe un título.",
  titleTooLong: "El título es demasiado largo: como mucho, 200 caracteres.",
  versionNameTooLong: "El nombre de la versión es demasiado largo: como mucho, 120 caracteres.",
  noteTextRequired: "La nota está vacía.",
  noteTextTooLong: "La nota es demasiado larga.",
  invalidContent: "No se pudo guardar este texto. Lo escrito sigue en pantalla.",
  documentNotFound: "Ese capítulo ya no está en el proyecto.",
  documentIsDeleted: "Ese capítulo está en la papelera. Restáuralo para seguir escribiendo en él.",
  documentIsNotDeleted: "Ese capítulo no está en la papelera.",
  positionOutOfRange: "No se puede colocar ahí.",
  versionOfAnotherDocument: "Esa versión es de otro capítulo.",
  versionNotFound: "Esa versión ya no existe.",
  noteNotFound: "Esa nota ya no existe.",
  notFound: "No se encuentra el archivo. Puede que se haya movido o borrado.",
  alreadyExists:
    "Ya hay un archivo con ese nombre en esa carpeta. Elige otro título u otra carpeta.",
  notAProject: "Ese archivo no es un proyecto de Rocinante.",
  newerVersion:
    "Ese proyecto se guardó con una versión más nueva de Rocinante. Actualiza la app para abrirlo.",
  corrupted: "El archivo del proyecto está dañado y no se puede abrir.",
};

/** The message for any failure: the reason's if it has one, a general one otherwise. */
export function messageFor(error: unknown): string {
  if (error instanceof CoreError) {
    if (error.reason) return messages[error.reason];
    if (error.code === ErrorCodes.CoreUnavailable) {
      return "Rocinante no responde. Cierra la app y vuelve a abrirla; lo guardado está a salvo.";
    }
  }
  return "Algo no ha ido bien. Vuelve a intentarlo; lo guardado está a salvo.";
}
