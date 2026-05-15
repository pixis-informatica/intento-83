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
        var urlObj = new URL(url, window.location.href);
        urlObj.searchParams.set('v', window.PIXIS_VERSION);
        urlObj.searchParams.delete('_');
        finalUrl = urlObj.toString();
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

    window._originalFetch = window.fetch;
    var inFlightFetches = {};

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
          var finalUrl;
          try {
            var urlObj = new URL(url, window.location.href);
            urlObj.searchParams.set('v', window.PIXIS_VERSION);
            urlObj.searchParams.delete('_');
            finalUrl = urlObj.toString();
          } catch(e) {
             finalUrl = url;
          }

          // DEDUPLICADOR: Si ya hay un fetch en curso para esta URL exacta, 
          // reutilizamos la promesa para que state.js no vuelva a descargar lo que ya pre-cargamos.
          if (inFlightFetches[finalUrl]) {
            return inFlightFetches[finalUrl].then(function(text) {
              return new Response(text, { status: 200, headers: {'Content-Type': 'application/json'} });
            });
          }

          var p = window.fetchVersioned(url, options).then(function(res) {
            if (!res.ok) throw new Error('Fetch failed');
            return res.text();
          });
          
          inFlightFetches[finalUrl] = p;

          return p.then(function(text) {
            return new Response(text, { status: 200, headers: {'Content-Type': 'application/json'} });
          });
        }
      }
      return window._originalFetch.apply(this, arguments);
    };

    // ¡PREFETCH PARALELO MASIVO! 
    // Aplanamos la cascada de red iniciando estas descargas pesadas antes de que empiece a cargar cart o state.
    if (!window.location.search.includes('edit=true')) {
      window.fetch('/data/products.json?_=' + Date.now());
      window.fetch('/data/categories.json?_=' + Date.now());
      window.fetch('/data/ui.json?_=' + Date.now());
    }

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
          return new Promise(function(resolve) {
            var s = document.createElement('script');
            s.src = 'editor/editor.js?_=' + Date.now();
            s.onload = resolve;
            s.onerror = resolve;
            document.body.appendChild(s);
          });
        }
      })
      .then(function () {
        // Prevención de Race Condition: Al descentralizar este loader del HTML a un archivo .js,
        // window.onload generalmente se dispara ANTES de que js/state.js se termine de descargar y evalúe.
        // Si el DOM ya cargó, disparamos el evento manualmente para inicializar PixisState.
        if (document.readyState === 'complete') {
          window.dispatchEvent(new Event('load'));
        }
      });
  }

  // Ejecutamos inicialización de forma segura
  initVersionalizador();
})();
