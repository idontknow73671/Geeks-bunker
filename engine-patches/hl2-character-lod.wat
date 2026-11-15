;; libengine.so SHA-256:
;; fc0c18859a1bc0de4968c91953bccfad70112137e34ed2c2664d6d5c6e2b902b
;; CModelRender::ComputeLOD, f1066, final web character override block.
;; Original reads r_web_char_lod (default 3) after normal LOD/root clamping:
;;   global.get $env.__memory_base
;;   i32.const 819344
;;   i32.add
;;   i32.load offset=28
;;   i32.load offset=48
;; Replacement result -1 takes the existing negative-value branch past the
;; override. The preceding distance-based/r_lod selection and root clamp stay.
;; Fill the remaining 17 bytes with nop to preserve relocation/section offsets.
i32.const -1
nop nop nop nop nop nop nop nop nop nop nop nop nop nop nop nop nop
