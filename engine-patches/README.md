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
- Legacy v44-v49 character models can leave eye texture indices zero while
  their eye meshes select other materials. Parse each body/model's eye-mesh
  mapping and normalize unambiguous missing indices on mounting. This covers
  citizens, Barney, Breen and Vortigaunts as well as G-Man. Explicit indices,
  valid material-zero eyes and ambiguous mappings remain intact. Malformed
  bounds reject the whole repair before any bytes are copied. The former
  renderer patch that bypassed material checks is **not** used.
- `libengine.so` SHA-256
  `fc0c18859a1bc0de4968c91953bccfad70112137e34ed2c2664d6d5c6e2b902b`:
  `CModelRender::ComputeLOD` (f1066) applies a separate web character LOD=3
  override after its normal calculation. Those meshes omit eyes/flexes. Replace
  only its override-value read with -1, taking the existing skip branch.
  Ordinary distance-based detail, `r_lod`, root clamping and shadow LODs remain
  intact. The same-size replacement preserves relocation offsets. See
  `hl2-character-lod.wat`.

All other WASM sections and all untouched function bodies remain byte-for-byte
identical. Unknown builds pass through as a complete original set. Model data is
copied before normalization; save paths and asset origins do not change. The
existing SDL/OpenAL context-resume correction remains separate.

Verification uses real binaries kept outside the repository:

```sh
HL2_ENGINE_FIXTURES=/absolute/path/to/hl2-investigation node --test tests/hl2-native.test.mjs
```

That directory contains `cache/{index.js,libtogl.so,libclient.so,libstudiorender.so,libengine.so}`
and `assets/hl2/models/gman_high.mdl`, plus the extracted character files in
`npc-assets/hl2/models/` for the character coverage test. Tests validate hashes, WASM validity,
idempotence, unchanged linking/custom sections, changed body counts, model eye fields, malformed layouts, all 19 cached character models, original
resource URLs and complete-set fallback.
