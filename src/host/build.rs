use std::path::{Path, PathBuf};
use std::{env, fs};

const SIDECAR: &str = "rocinante-core";

fn main() {
    tauri_build::build();
    copy_sidecar_next_to_executable();
}

/// Places the .NET core next to the development executable.
///
/// `tauri-build` assumes `OUT_DIR` is `<target>/<profile>/build/<pkg>-<hash>/out`.
/// Recent Cargo versions use `<target>/<profile>/build/<pkg>/<hash>/out`, so it
/// copies the sidecar one level too deep and `tauri dev` cannot find it.
/// Release bundles are unaffected: the bundler resolves `externalBin` itself.
fn copy_sidecar_next_to_executable() {
    let target = env::var("TARGET").expect("TARGET is set by Cargo");
    let extension = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    let source = PathBuf::from(format!("binaries/{SIDECAR}-{target}{extension}"));
    println!("cargo:rerun-if-changed={}", source.display());

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is set by Cargo"));
    let Some(profile_dir) = profile_dir(&out_dir) else {
        println!("cargo:warning=could not locate the profile directory from OUT_DIR");
        return;
    };

    let destination = profile_dir.join(format!("{SIDECAR}{extension}"));
    if let Err(error) = fs::copy(&source, &destination) {
        println!("cargo:warning=sidecar not copied ({error}); run `npm run core:build` first");
    }
}

/// The profile directory (e.g. `target/debug`) is the parent of the `build` ancestor.
fn profile_dir(out_dir: &Path) -> Option<&Path> {
    out_dir
        .ancestors()
        .find(|dir| dir.file_name().is_some_and(|name| name == "build"))
        .and_then(Path::parent)
}
