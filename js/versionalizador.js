//* ════ PIXIS CACHE BUSTER — Loader dinámico de versiones ════ *//
(function () {
  function initVersionalizador() {
    // 1. Obtener la versión manual del tag de script en index.html
    var configVersion = '1.0';
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.includes('versionalizador.js')) {
        var match = scripts[i].src.match(/[\?&]v=([^&]+)/);
        if (match) {
          configVersion = match[1];
        }
        break;
      }
    }

    // 4. Crear versión global reutilizable
    window.PIXIS_VERSION = configVersion;
    console.log('[Pixis] Iniciando Versionalizador Global v' + window.PIXIS_VERSION);

    // 5. Crear helpers reutilizables
    window.loadVersionedScript = function (src) {
      return new Promise(function (resolve) {
        var baseSrc = src.split('?')[0];
        var finalUrl = baseSrc + '?v=' + window.PIXIS_VERSION;

        var s = document.createElement('script');
        s.src = finalUrl;
        s.onload = resolve;
        s.onerror = resolve; // Continuar aunque falle
        document.body.appendChild(s);
      });
    };

    window.fetchVersioned = function (url, options) {
      var baseUrl = url.split('?')[0];
      var finalUrl = baseUrl + '?v=' + window.PIXIS_VERSION;

      var finalOptions = Object.assign({}, options || {}, {
        cache: 'no-store',
        headers: Object.assign({}, (options && options.headers) || {}, {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        })
      });

      return window._originalFetch(finalUrl, finalOptions);
    };

    // 3. Agregar manejo/versionado interceptando llamadas a fetch nativo para los JSON
    window._originalFetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'string') {
        var isTarget = url.includes('site.json') ||
          url.includes('products.json') ||
          url.includes('categories.json') ||
          url.includes('ui.json');
        if (isTarget) {
          return window.fetchVersioned(url, arguments[1]);
        }
      }
      return window._originalFetch.apply(this, arguments);
    };

    // Lógica anterior de inicialización de scripts base (cart y state)
    // Forzamos la carga inicial de site.json a través de nuestra función versionada
    window.fetchVersioned('/data/site.json')
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; })
      .then(function (site) {
        console.log('[Pixis] Cargando scripts con versión de caché: v' + window.PIXIS_VERSION);
        return window.loadVersionedScript('js/cart.js')
          .then(function () {
            return window.loadVersionedScript('js/state.js');
          });
      })
      .then(function () {
        // Lógica de editor original
        if (location.search.includes('edit=true')) {
          var s = document.createElement('script');
          s.src = 'editor/editor.js?_=' + Date.now();
          document.body.appendChild(s);
        }
      });
  }

  // Ejecutamos inicialización de forma segura
  initVersionalizador();
})();
