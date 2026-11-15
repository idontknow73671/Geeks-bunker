;; Replacement function fragments for client SHA-256
;; 69f7b3d2722e3c3941f7a2baa72b3f663cf86d67d40467ae6a872fd531787798
;; f1163: GetModelPtr initialization; f1970: AddGlobalFlexController
;; f1996: SetupGlobalWeights (includes ProcessSceneEvents and ProcessVisemes)
;; f1997: SetupLocalWeights (runs native flex rules and delay)
;; f1993 adjusts IClientRenderable this by -4 before entering SetupWeights.
;; No imports, exports, data, audio processing or save formats are modified.
  (func $f1992 (type $t7) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32)
(local $hdr i32) (local $raw i32) (local $i i32) (local $fc i32)
block $done
 local.get $p0 i32.load8_u offset=2112 br_if $done
 local.get $p0 i32.load offset=2120 local.set $hdr
 local.get $hdr i32.eqz if
 local.get $p0 call $f1163
 local.get $p0 i32.load offset=2120 local.set $hdr
 end
 local.get $hdr i32.eqz br_if $done
 local.get $hdr i32.load local.set $raw
 local.get $raw i32.load offset=268 i32.const 0 i32.gt_s if
 local.get $raw local.get $raw i32.load offset=272 i32.add i32.load offset=8 i32.const -1 i32.eq
 if
 i32.const 0 local.set $i
 loop $link
 local.get $raw local.get $raw i32.load offset=272 i32.add local.get $i i32.const 20 i32.mul i32.add local.set $fc
 local.get $fc local.get $fc local.get $fc i32.load offset=4 i32.add call $f1970 i32.store offset=8
 local.get $i i32.const 1 i32.add local.tee $i local.get $raw i32.load offset=268 i32.lt_s br_if $link
 end
 end
 end
 local.get $p0 local.get $p1 local.get $p2 local.get $p3 local.get $p4 call $f1996
 if
 local.get $p0 local.get $p1 local.get $p2 local.get $p3 local.get $p4 call $f1997
 end
end)
(func $f1993 (type $t7) (param $p0 i32) (param $p1 i32) (param $p2 i32) (param $p3 i32) (param $p4 i32)
 local.get $p0 i32.const -4 i32.add local.get $p1 local.get $p2 local.get $p3 local.get $p4 call $f1992)
