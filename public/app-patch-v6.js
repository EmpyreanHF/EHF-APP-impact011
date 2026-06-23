/* =============================================================================
   EMPYREAN INTERNATIONAL — PATCH v6  (DEFINITIVE — v3)
   app-patch-v6.js  |  Load AFTER app-patch-v5.js

   ROOT CAUSE — CONFIRMED
   ──────────────────────
   When a VIDEO post card is cloned into #vf-th-post-area (the thread page),
   the .vfs-tap div that app-video-fullscreen.js injected into the original
   feed card is included in the clone (cloneNode(true) copies DOM structure).

   The .vfs-tap is styled:
       position: absolute; inset: 0; z-index: 20;
   It needs its PARENT (.story-media-item) to be position:relative to stay
   contained inside the media thumbnail.

   BUT .story-media-item has NO position:relative in any stylesheet.
   So inside #vf-thread, the .vfs-tap's absolute positioning crawls up the
   DOM to find the nearest positioned ancestor — which is #vf-thread itself
   (position:fixed; inset:0).

   Result: .vfs-tap expands to cover the ENTIRE thread panel.
   Combined with the thread CSS rule:
       #vf-thread * { pointer-events: auto !important; }
   ...the .vfs-tap becomes a full-screen invisible glass pane that intercepts
   every tap. Buttons get CSS :active (visual blink) because the click
   physically registers, but the tap target is .vfs-tap, not the button.

   IMAGE posts don't have this problem because _decorateItem() only injects
   .vfs-tap when item.querySelector('video') is truthy. Image posts have no
   .vfs-tap, so nothing bleeds out.

   TWO-LINE FIX:
   (A) Add position:relative to .story-media-item so .vfs-tap stays contained.
   (B) Remove any .vfs-tap that gets cloned into #vf-th-post-area (belt+suspenders).
   ============================================================================= */

(function empyreanPatchV6() {
    'use strict';


    /* =========================================================================
       FIX A — CSS: give .story-media-item position:relative
       =========================================================================
       This is the root fix. .vfs-tap is position:absolute;inset:0 and must
       be contained by its parent .story-media-item. Without position:relative
       on the parent, .vfs-tap escapes to the nearest positioned ancestor
       (which inside #vf-thread is the fixed full-screen overlay itself).
    ========================================================================= */
    (function injectContainmentCSS() {
        if (document.getElementById('_pv6_media_contain')) return;
        var s = document.createElement('style');
        s.id = '_pv6_media_contain';
        s.textContent = [
            /* Contain .vfs-tap inside its media item */
            '.story-media-item {',
            '    position: relative;',
            '    overflow: hidden;',
            '}',
            /* Belt-and-suspenders: ensure .vfs-tap never bleeds out anywhere */
            '.story-media-item .vfs-tap {',
            '    position: absolute !important;',
            '    top: 0 !important;',
            '    left: 0 !important;',
            '    right: 0 !important;',
            '    bottom: 0 !important;',
            '    width: auto !important;',
            '    height: auto !important;',
            '    z-index: 20 !important;',
            '}',
            /* Inside the thread post area, vfs-tap must never intercept anything */
            '#vf-th-post-area .vfs-tap,',
            '#vf-th-post-area .vfs-expand {',
            '    display: none !important;',
            '    pointer-events: none !important;',
            '}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    })();


    /* =========================================================================
       FIX B — DOM: strip .vfs-tap/.vfs-expand from cloned thread post area
       =========================================================================
       Belt-and-suspenders. Whenever openThread() clones a video post into
       #vf-th-post-area, remove any .vfs-tap and .vfs-expand divs immediately.
       We hook this via MutationObserver on #vf-th-post-area.
    ========================================================================= */
    (function stripVfsTapFromThread() {

        function _clean(root) {
            if (!root) return;
            root.querySelectorAll('.vfs-tap, .vfs-expand').forEach(function (el) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                /* Remove entirely after a tick so no layout flash */
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 0);
            });
        }

        function _watchPostArea() {
            var area = document.getElementById('vf-th-post-area');
            if (!area || area._pv6Watched) return;
            area._pv6Watched = true;

            /* Clean on initial content */
            _clean(area);

            /* Watch for new content injected by openThread() */
            new MutationObserver(function () {
                _clean(area);
            }).observe(area, { childList: true, subtree: true });
        }

        /* Run now and after init */
        if (document.readyState !== 'loading') {
            setTimeout(_watchPostArea, 200);
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(_watchPostArea, 200);
            });
        }
        document.addEventListener('empyrean-init-done', function () {
            setTimeout(_watchPostArea, 300);
        });

        /* Also hook into openThread itself for instant cleanup */
        function _patchOpenThread() {
            var orig = window._vfOpenThread;
            if (!orig || orig._pv6Patched) return;
            window._vfOpenThread = function (postEl) {
                var result = orig.apply(this, arguments);
                /* Clean up immediately after thread opens */
                setTimeout(function () {
                    _clean(document.getElementById('vf-th-post-area'));
                }, 50);
                return result;
            };
            window._vfOpenThread._pv6Patched = true;
            window._vfOpenThread._orig = orig;
        }

        _patchOpenThread();
        document.addEventListener('empyrean-init-done', function () {
            setTimeout(_patchOpenThread, 400);
        });

    })();


    console.log('[EmpyreanPatchV6] ✅ Video thread button freeze fixed — .vfs-tap contained to .story-media-item, stripped from thread post area.');

})();