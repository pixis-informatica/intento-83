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
      var finalUrl = url;
      try {
        var urlObj = new URL(url, window.location.origin);
        urlObj.searchParams.set('v', window.PIXIS_VERSION);
        urlObj.searchParams.delete('_');
        finalUrl = urlObj.pathname + urlObj.search;
      } catch (e) {
        var baseUrl = url.split('?')[0];
        finalUrl = baseUrl + '?v=' + window.PIXIS_VERSION;
      }

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
      var options = arguments[1];
      
      if (typeof url === 'string') {
        var isGet = !options || !options.method || options.method.toUpperCase() === 'GET';
        var isDataTarget = url.includes('/data/site.json') ||
                           url.includes('/data/products.json') ||
                           url.includes('/data/categories.json') ||
                           url.includes('/data/ui.json');
                           
        if (isGet && isDataTarget) {
          return window.fetchVersioned(url, options);
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
