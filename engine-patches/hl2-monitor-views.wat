;; libclient.so original SHA-256:
;; 69f7b3d2722e3c3941f7a2baa72b3f663cf86d67d40467ae6a872fd531787798
;; CViewRender::DrawMonitors, f8962 (code body 8779).
;; After GetLocalPlayer -> l6, inside outer B0:
local.get $l6
 i32.eqz
 br_if $B0
;; At the start of each camera's B2, before the dormant/force-camera block:
local.get $l2
 i32.load8_u offset=1308 ;; DT_PointCamera.m_bActive
 i32.eqz
 br_if $B2
;; The active check restores the normal Source engine camera selection.
;; Inactive cameras must not overwrite a live feed in shared _rt_Camera.
