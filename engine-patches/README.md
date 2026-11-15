# HL2 native compatibility repairs

`hl2-native.js` patches only SHA-256 identified upstream modules in memory. It
ships no engine binaries, maps, textures, audio, or other game assets.

The tested repairs are a set:

- `libtogl.so`: `IDirect3DDevice9::DrawIndexedPrimitive` calculates a base vertex
  in `FlushVertexBindings`, but the Linux `FlushDrawStates` implementation ignores
  that setup. Pass the base to `FlushDrawStates`, include `base * stride` in each
  attribute offset, and bypass the outer cache that does not key on the base.
  Per-attribute caching remains. Two code bodies change; the module grows 9 bytes.
- `libclient.so`: restore `C_BaseFlex::SetupWeights` and its adjusting thunk;
  the compiled upstream bodies only zero the output. Reuse the existing scene,
  viseme, controller and flex-rule functions. See `hl2-flex.wat`.
- `libstudiorender.so`: `CStudioRender::DrawModel` clears the `bFlex` bit
  unconditionally immediately after its legitimate `DRAW_NO_FLEXES` condition.
  Change that second mask from `0xffbf` to `0xffff` (one byte), preserving the
  explicit no-flex flag and the existing restoration at the end of the draw.
- The exact original v44 `gman_high.mdl` has zero eye texture indices while its
  right/left eye meshes use materials 4/2. Normalize those two fields on mounting.
  The former renderer patch that bypassed material checks is **not** used.

All other WASM sections and all untouched function bodies remain byte-for-byte
identical. Unknown builds pass through as a complete original set. Model data is
copied before normalization; save paths and asset origins do not change. The
existing SDL/OpenAL context-resume correction remains separate.

Verification uses real binaries kept outside the repository:

```sh
HL2_ENGINE_FIXTURES=/absolute/path/to/hl2-investigation node --test tests/hl2-native.test.mjs
```

That directory contains `cache/{index.js,libtogl.so,libclient.so,libstudiorender.so}`
and `assets/hl2/models/gman_high.mdl`. Tests validate hashes, WASM validity,
idempotence, unchanged linking/custom sections, changed body counts, the exact
two model bytes, original resource URLs and complete-set fallback.
