//! The `ambience://` protocol: the windows read the copies of the writer's own images and
//! sounds that the core keeps in the app data folder, and nothing else. Only the names the core
//! gives its copies are served (`<uuid>.<extension>`), so no request can leave that folder.

use std::path::Path;

use tauri::http::{Request, Response, StatusCode, header};
use tauri::{AppHandle, Manager, UriSchemeResponder};

/// The scheme the windows use; on Windows it is reached as `http://ambience.localhost/`.
pub const SCHEME: &str = "ambience";

/// The folder of the app data folder where the core keeps the copies.
const FOLDER: &str = "ambience";

/// The media type of a copy by its name, if it is a name the core would give one.
pub fn media_type(name: &str) -> Option<&'static str> {
    let (stem, extension) = name.split_once('.')?;
    let uuid = stem.len() == 36
        && stem.char_indices().all(|(at, c)| match at {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_digit() || ('a'..='f').contains(&c),
        });
    if !uuid {
        return None;
    }
    match extension {
        "png" => Some("image/png"),
        "jpg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "ogg" => Some("audio/ogg"),
        "mp3" => Some("audio/mpeg"),
        "wav" => Some("audio/wav"),
        "flac" => Some("audio/flac"),
        _ => None,
    }
}

/// Answers a request; the file is read off the main thread, as a sound can be large.
pub fn serve(app: &AppHandle, request: &Request<Vec<u8>>, responder: UriSchemeResponder) {
    let name = request.uri().path().trim_start_matches('/').to_owned();
    let folder = app.path().app_data_dir().map(|data| data.join(FOLDER));
    std::thread::spawn(move || {
        let response = match (media_type(&name), folder) {
            (Some(media), Ok(folder)) => read(&folder, &name, media),
            _ => status(StatusCode::NOT_FOUND),
        };
        responder.respond(response);
    });
}

fn read(folder: &Path, name: &str, media: &str) -> Response<Vec<u8>> {
    match std::fs::read(folder.join(name)) {
        Ok(bytes) => Response::builder()
            .header(header::CONTENT_TYPE, media)
            // The page's origin differs from the scheme's; it may read these, as the core wrote them.
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(bytes)
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR)),
        Err(_) => status(StatusCode::NOT_FOUND),
    }
}

/// An answer with no body. It carries the same header as a file, so the page sees the status
/// instead of a failed request.
fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response.headers_mut().insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        header::HeaderValue::from_static("*"),
    );
    response
}

#[cfg(test)]
mod tests {
    use super::media_type;

    #[test]
    fn serves_the_names_the_core_gives_its_copies() {
        assert_eq!(
            media_type("01a1ffbd-e4a7-70a0-b234-d75e2d37343a.png"),
            Some("image/png")
        );
        assert_eq!(
            media_type("01a1ffbd-e4b6-7194-aacf-3f11f9e9ae82.flac"),
            Some("audio/flac")
        );
    }

    #[test]
    fn refuses_anything_else() {
        for name in [
            "settings.json",
            "../settings.json",
            "..%2Fsettings.json",
            "01a1ffbd-e4a7-70a0-b234-d75e2d37343a.png/../../settings.json",
            "01a1ffbd-e4a7-70a0-b234-d75e2d37343a.exe",
            "01A1FFBD-E4A7-70A0-B234-D75E2D37343A.png",
            "01a1ffbd-e4a7-70a0-b234-d75e2d37343a",
            "01a1ffbd-e4a7-70a0-b234-d75e2d37343a.png.tmp",
            "",
        ] {
            assert_eq!(media_type(name), None, "{name}");
        }
    }
}
