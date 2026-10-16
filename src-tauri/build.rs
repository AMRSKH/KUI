fn main() {
    // Suppress the MinGW ld.exe ".rsrc merge failure: multiple non-default manifests"
    // warning. Tauri embeds its own Windows manifest; this tells the linker not to
    // also emit the default one from the binary crate.
    #[cfg(target_os = "windows")]
    {
        println!("cargo:rustc-link-arg-bins=-Wl,--no-seh");
    }

    tauri_build::build()
}
