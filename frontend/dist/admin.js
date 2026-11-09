var P2 = Object.create, _b = Object.defineProperty, X2 = Object.getOwnPropertyDescriptor, I2 = Object.getOwnPropertyNames, Q2 = Object.getPrototypeOf, Rb = Object.prototype.hasOwnProperty, va = (n, o) => () => (o || (n((o = { exports: {} }).exports, o), n = null), o.exports), Z2 = (n, o, r, i) => {
  if (o && typeof o == "object" || typeof o == "function")
    for (var c = I2(o), f = 0, d = c.length, m; f < d; f++)
      m = c[f], !Rb.call(n, m) && m !== r && _b(n, m, {
        get: ((h) => o[h]).bind(null, m),
        enumerable: !(i = X2(o, m)) || i.enumerable
      });
  return n;
}, Ab = (n, o, r) => (r = n != null ? P2(Q2(n)) : {}, Z2(o || !n || !n.__esModule || !Rb.call(n, "default") ? _b(r, "default", {
  value: n,
  enumerable: !0
}) : r, n)), K2 = /* @__PURE__ */ va(((n) => {
  var o = /* @__PURE__ */ Symbol.for("react.transitional.element"), r = /* @__PURE__ */ Symbol.for("react.portal"), i = /* @__PURE__ */ Symbol.for("react.fragment"), c = /* @__PURE__ */ Symbol.for("react.strict_mode"), f = /* @__PURE__ */ Symbol.for("react.profiler"), d = /* @__PURE__ */ Symbol.for("react.consumer"), m = /* @__PURE__ */ Symbol.for("react.context"), h = /* @__PURE__ */ Symbol.for("react.forward_ref"), g = /* @__PURE__ */ Symbol.for("react.suspense"), w = /* @__PURE__ */ Symbol.for("react.memo"), b = /* @__PURE__ */ Symbol.for("react.lazy"), v = /* @__PURE__ */ Symbol.for("react.activity"), x = /* @__PURE__ */ Symbol.for("react.view_transition"), E = Symbol.iterator;
  function C(N) {
    return N === null || typeof N != "object" ? null : (N = E && N[E] || N["@@iterator"], typeof N == "function" ? N : null);
  }
  var _ = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, R = Object.assign, M = {};
  function A(N, Z, ue) {
    this.props = N, this.context = Z, this.refs = M, this.updater = ue || _;
  }
  A.prototype.isReactComponent = {}, A.prototype.setState = function(N, Z) {
    if (typeof N != "object" && typeof N != "function" && N != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, N, Z, "setState");
  }, A.prototype.forceUpdate = function(N) {
    this.updater.enqueueForceUpdate(this, N, "forceUpdate");
  };
  function O() {
  }
  O.prototype = A.prototype;
  function D(N, Z, ue) {
    this.props = N, this.context = Z, this.refs = M, this.updater = ue || _;
  }
  var j = D.prototype = new O();
  j.constructor = D, R(j, A.prototype), j.isPureReactComponent = !0;
  var $ = Array.isArray;
  function H() {
  }
  var X = {
    H: null,
    A: null,
    T: null,
    S: null
  }, J = Object.prototype.hasOwnProperty;
  function W(N, Z, ue) {
    var re = ue.ref;
    return {
      $$typeof: o,
      type: N,
      key: Z,
      ref: re !== void 0 ? re : null,
      props: ue
    };
  }
  function ie(N, Z) {
    return W(N.type, Z, N.props);
  }
  function ae(N) {
    return typeof N == "object" && N !== null && N.$$typeof === o;
  }
  function q(N) {
    var Z = {
      "=": "=0",
      ":": "=2"
    };
    return "$" + N.replace(/[=:]/g, function(ue) {
      return Z[ue];
    });
  }
  var me = /\/+/g;
  function B(N, Z) {
    return typeof N == "object" && N !== null && N.key != null ? q("" + N.key) : Z.toString(36);
  }
  function G(N) {
    switch (N.status) {
      case "fulfilled":
        return N.value;
      case "rejected":
        throw N.reason;
      default:
        switch (typeof N.status == "string" ? N.then(H, H) : (N.status = "pending", N.then(function(Z) {
          N.status === "pending" && (N.status = "fulfilled", N.value = Z);
        }, function(Z) {
          N.status === "pending" && (N.status = "rejected", N.reason = Z);
        })), N.status) {
          case "fulfilled":
            return N.value;
          case "rejected":
            throw N.reason;
        }
    }
    throw N;
  }
  function k(N, Z, ue, re, ge) {
    var he = typeof N;
    (he === "undefined" || he === "boolean") && (N = null);
    var ye = !1;
    if (N === null) ye = !0;
    else switch (he) {
      case "bigint":
      case "string":
      case "number":
        ye = !0;
        break;
      case "object":
        switch (N.$$typeof) {
          case o:
          case r:
            ye = !0;
            break;
          case b:
            return ye = N._init, k(ye(N._payload), Z, ue, re, ge);
        }
    }
    if (ye) return ge = ge(N), ye = re === "" ? "." + B(N, 0) : re, $(ge) ? (ue = "", ye != null && (ue = ye.replace(me, "$&/") + "/"), k(ge, Z, ue, "", function(Ne) {
      return Ne;
    })) : ge != null && (ae(ge) && (ge = ie(ge, ue + (ge.key == null || N && N.key === ge.key ? "" : ("" + ge.key).replace(me, "$&/") + "/") + ye)), Z.push(ge)), 1;
    ye = 0;
    var ve = re === "" ? "." : re + ":";
    if ($(N)) for (var de = 0; de < N.length; de++) re = N[de], he = ve + B(re, de), ye += k(re, Z, ue, he, ge);
    else if (de = C(N), typeof de == "function") for (N = de.call(N), de = 0; !(re = N.next()).done; ) re = re.value, he = ve + B(re, de++), ye += k(re, Z, ue, he, ge);
    else if (he === "object") {
      if (typeof N.then == "function") return k(G(N), Z, ue, re, ge);
      throw Z = String(N), Error("Objects are not valid as a React child (found: " + (Z === "[object Object]" ? "object with keys {" + Object.keys(N).join(", ") + "}" : Z) + "). If you meant to render a collection of children, use an array instead.");
    }
    return ye;
  }
  function I(N, Z, ue) {
    if (N == null) return N;
    var re = [], ge = 0;
    return k(N, re, "", "", function(he) {
      return Z.call(ue, he, ge++);
    }), re;
  }
  function ee(N) {
    if (N._status === -1) {
      var Z = N._result, ue = Z();
      ue.then(function(re) {
        (N._status === 0 || N._status === -1) && (N._status = 1, N._result = re, ue.status === void 0 && (ue.status = "fulfilled", ue.value = re));
      }, function(re) {
        (N._status === 0 || N._status === -1) && (N._status = 2, N._result = re, ue.status === void 0 && (ue.status = "rejected", ue.reason = re));
      }), N._status === -1 && (N._status = 0, N._result = ue);
    }
    if (N._status === 1) return N._result.default;
    throw N._result;
  }
  var te = typeof reportError == "function" ? reportError : function(N) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Z = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof N == "object" && N !== null && typeof N.message == "string" ? String(N.message) : String(N),
        error: N
      });
      if (!window.dispatchEvent(Z)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", N);
      return;
    }
    console.error(N);
  };
  function ne(N) {
    var Z = X.T, ue = {};
    ue.types = Z !== null ? Z.types : null, X.T = ue;
    try {
      var re = N(), ge = X.S;
      ge !== null && ge(ue, re), typeof re == "object" && re !== null && typeof re.then == "function" && re.then(H, te);
    } catch (he) {
      te(he);
    } finally {
      Z !== null && ue.types !== null && (Z.types = ue.types), X.T = Z;
    }
  }
  function ce(N) {
    var Z = X.T;
    if (Z !== null) {
      var ue = Z.types;
      ue === null ? Z.types = [N] : ue.indexOf(N) === -1 && ue.push(N);
    } else ne(ce.bind(null, N));
  }
  var fe = {
    map: I,
    forEach: function(N, Z, ue) {
      I(N, function() {
        Z.apply(this, arguments);
      }, ue);
    },
    count: function(N) {
      var Z = 0;
      return I(N, function() {
        Z++;
      }), Z;
    },
    toArray: function(N) {
      return I(N, function(Z) {
        return Z;
      }) || [];
    },
    only: function(N) {
      if (!ae(N)) throw Error("React.Children.only expected to receive a single React element child.");
      return N;
    }
  };
  n.Activity = v, n.Children = fe, n.Component = A, n.Fragment = i, n.Profiler = f, n.PureComponent = D, n.StrictMode = c, n.Suspense = g, n.ViewTransition = x, n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = X, n.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(N) {
      return X.H.useMemoCache(N);
    }
  }, n.addTransitionType = ce, n.cache = function(N) {
    return function() {
      return N.apply(null, arguments);
    };
  }, n.cacheSignal = function() {
    return null;
  }, n.cloneElement = function(N, Z, ue) {
    if (N == null) throw Error("The argument must be a React element, but you passed " + N + ".");
    var re = R({}, N.props), ge = N.key;
    if (Z != null) for (he in Z.key !== void 0 && (ge = "" + Z.key), Z) !J.call(Z, he) || he === "key" || he === "__self" || he === "__source" || he === "ref" && Z.ref === void 0 || (re[he] = Z[he]);
    var he = arguments.length - 2;
    if (he === 1) re.children = ue;
    else if (1 < he) {
      for (var ye = Array(he), ve = 0; ve < he; ve++) ye[ve] = arguments[ve + 2];
      re.children = ye;
    }
    return W(N.type, ge, re);
  }, n.createContext = function(N) {
    return N = {
      $$typeof: m,
      _currentValue: N,
      _currentValue2: N,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, N.Provider = N, N.Consumer = {
      $$typeof: d,
      _context: N
    }, N;
  }, n.createElement = function(N, Z, ue) {
    var re, ge = {}, he = null;
    if (Z != null) for (re in Z.key !== void 0 && (he = "" + Z.key), Z) J.call(Z, re) && re !== "key" && re !== "__self" && re !== "__source" && (ge[re] = Z[re]);
    var ye = arguments.length - 2;
    if (ye === 1) ge.children = ue;
    else if (1 < ye) {
      for (var ve = Array(ye), de = 0; de < ye; de++) ve[de] = arguments[de + 2];
      ge.children = ve;
    }
    if (N && N.defaultProps) for (re in ye = N.defaultProps, ye) ge[re] === void 0 && (ge[re] = ye[re]);
    return W(N, he, ge);
  }, n.createRef = function() {
    return { current: null };
  }, n.forwardRef = function(N) {
    return {
      $$typeof: h,
      render: N
    };
  }, n.isValidElement = ae, n.lazy = function(N) {
    return {
      $$typeof: b,
      _payload: {
        _status: -1,
        _result: N
      },
      _init: ee
    };
  }, n.memo = function(N, Z) {
    return {
      $$typeof: w,
      type: N,
      compare: Z === void 0 ? null : Z
    };
  }, n.startTransition = ne, n.unstable_useCacheRefresh = function() {
    return X.H.useCacheRefresh();
  }, n.use = function(N) {
    return X.H.use(N);
  }, n.useActionState = function(N, Z, ue) {
    return X.H.useActionState(N, Z, ue);
  }, n.useCallback = function(N, Z) {
    return X.H.useCallback(N, Z);
  }, n.useContext = function(N) {
    return X.H.useContext(N);
  }, n.useDebugValue = function() {
  }, n.useDeferredValue = function(N, Z) {
    return X.H.useDeferredValue(N, Z);
  }, n.useEffect = function(N, Z) {
    return X.H.useEffect(N, Z);
  }, n.useEffectEvent = function(N) {
    return X.H.useEffectEvent(N);
  }, n.useId = function() {
    return X.H.useId();
  }, n.useImperativeHandle = function(N, Z, ue) {
    return X.H.useImperativeHandle(N, Z, ue);
  }, n.useInsertionEffect = function(N, Z) {
    return X.H.useInsertionEffect(N, Z);
  }, n.useLayoutEffect = function(N, Z) {
    return X.H.useLayoutEffect(N, Z);
  }, n.useMemo = function(N, Z) {
    return X.H.useMemo(N, Z);
  }, n.useOptimistic = function(N, Z) {
    return X.H.useOptimistic(N, Z);
  }, n.useReducer = function(N, Z, ue) {
    return X.H.useReducer(N, Z, ue);
  }, n.useRef = function(N) {
    return X.H.useRef(N);
  }, n.useState = function(N) {
    return X.H.useState(N);
  }, n.useSyncExternalStore = function(N, Z, ue) {
    return X.H.useSyncExternalStore(N, Z, ue);
  }, n.useTransition = function() {
    return X.H.useTransition();
  }, n.version = "19.3.0";
})), Zm = /* @__PURE__ */ va(((n, o) => {
  o.exports = K2();
})), F2 = /* @__PURE__ */ va(((n) => {
  function o(B, G) {
    var k = B.length;
    B.push(G);
    e: for (; 0 < k; ) {
      var I = k - 1 >>> 1, ee = B[I];
      if (0 < c(ee, G)) B[I] = G, B[k] = ee, k = I;
      else break e;
    }
  }
  function r(B) {
    return B.length === 0 ? null : B[0];
  }
  function i(B) {
    if (B.length === 0) return null;
    var G = B[0], k = B.pop();
    if (k !== G) {
      B[0] = k;
      e: for (var I = 0, ee = B.length, te = ee >>> 1; I < te; ) {
        var ne = 2 * (I + 1) - 1, ce = B[ne], fe = ne + 1, N = B[fe];
        if (0 > c(ce, k)) fe < ee && 0 > c(N, ce) ? (B[I] = N, B[fe] = k, I = fe) : (B[I] = ce, B[ne] = k, I = ne);
        else if (fe < ee && 0 > c(N, k)) B[I] = N, B[fe] = k, I = fe;
        else break e;
      }
    }
    return G;
  }
  function c(B, G) {
    var k = B.sortIndex - G.sortIndex;
    return k !== 0 ? k : B.id - G.id;
  }
  if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
    var f = performance;
    n.unstable_now = function() {
      return f.now();
    };
  } else {
    var d = Date, m = d.now();
    n.unstable_now = function() {
      return d.now() - m;
    };
  }
  var h = [], g = [], w = 1, b = null, v = 3, x = !1, E = !1, C = !1, _ = !1, R = typeof setTimeout == "function" ? setTimeout : null, M = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
  function O(B) {
    for (var G = r(g); G !== null; ) {
      if (G.callback === null) i(g);
      else if (G.startTime <= B) i(g), G.sortIndex = G.expirationTime, o(h, G);
      else break;
      G = r(g);
    }
  }
  function D(B) {
    if (C = !1, O(B), !E) if (r(h) !== null) E = !0, j || (j = !0, ie());
    else {
      var G = r(g);
      G !== null && me(D, G.startTime - B);
    }
  }
  var j = !1, $ = -1, H = 5, X = -1;
  function J() {
    return _ ? !0 : !(n.unstable_now() - X < H);
  }
  function W() {
    if (_ = !1, j) {
      var B = n.unstable_now();
      X = B;
      var G = !0;
      try {
        e: {
          E = !1, C && (C = !1, M($), $ = -1), x = !0;
          var k = v;
          try {
            t: {
              for (O(B), b = r(h); b !== null && !(b.expirationTime > B && J()); ) {
                var I = b.callback;
                if (typeof I == "function") {
                  b.callback = null, v = b.priorityLevel;
                  var ee = I(b.expirationTime <= B);
                  if (B = n.unstable_now(), typeof ee == "function") {
                    b.callback = ee, O(B), G = !0;
                    break t;
                  }
                  b === r(h) && i(h), O(B);
                } else i(h);
                b = r(h);
              }
              if (b !== null) G = !0;
              else {
                var te = r(g);
                te !== null && me(D, te.startTime - B), G = !1;
              }
            }
            break e;
          } finally {
            b = null, v = k, x = !1;
          }
          G = void 0;
        }
      } finally {
        G ? ie() : j = !1;
      }
    }
  }
  var ie;
  if (typeof A == "function") ie = function() {
    A(W);
  };
  else if (typeof MessageChannel < "u") {
    var ae = new MessageChannel(), q = ae.port2;
    ae.port1.onmessage = W, ie = function() {
      q.postMessage(null);
    };
  } else ie = function() {
    R(W, 0);
  };
  function me(B, G) {
    $ = R(function() {
      B(n.unstable_now());
    }, G);
  }
  n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(B) {
    B.callback = null;
  }, n.unstable_forceFrameRate = function(B) {
    0 > B || 125 < B ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : H = 0 < B ? Math.floor(1e3 / B) : 5;
  }, n.unstable_getCurrentPriorityLevel = function() {
    return v;
  }, n.unstable_next = function(B) {
    switch (v) {
      case 1:
      case 2:
      case 3:
        var G = 3;
        break;
      default:
        G = v;
    }
    var k = v;
    v = G;
    try {
      return B();
    } finally {
      v = k;
    }
  }, n.unstable_requestPaint = function() {
    _ = !0;
  }, n.unstable_runWithPriority = function(B, G) {
    switch (B) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        B = 3;
    }
    var k = v;
    v = B;
    try {
      return G();
    } finally {
      v = k;
    }
  }, n.unstable_scheduleCallback = function(B, G, k) {
    var I = n.unstable_now();
    switch (typeof k == "object" && k !== null ? (k = k.delay, k = typeof k == "number" && 0 < k ? I + k : I) : k = I, B) {
      case 1:
        var ee = -1;
        break;
      case 2:
        ee = 250;
        break;
      case 5:
        ee = 1073741823;
        break;
      case 4:
        ee = 1e4;
        break;
      default:
        ee = 5e3;
    }
    return ee = k + ee, B = {
      id: w++,
      callback: G,
      priorityLevel: B,
      startTime: k,
      expirationTime: ee,
      sortIndex: -1
    }, k > I ? (B.sortIndex = k, o(g, B), r(h) === null && B === r(g) && (C ? (M($), $ = -1) : C = !0, me(D, k - I))) : (B.sortIndex = ee, o(h, B), E || x || (E = !0, j || (j = !0, ie()))), B;
  }, n.unstable_shouldYield = J, n.unstable_wrapCallback = function(B) {
    var G = v;
    return function() {
      var k = v;
      v = G;
      try {
        return B.apply(this, arguments);
      } finally {
        v = k;
      }
    };
  };
})), J2 = /* @__PURE__ */ va(((n, o) => {
  o.exports = F2();
})), W2 = /* @__PURE__ */ va(((n) => {
  var o = Zm();
  function r(b) {
    var v = "https://react.dev/errors/" + b;
    if (1 < arguments.length) {
      v += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var x = 2; x < arguments.length; x++) v += "&args[]=" + encodeURIComponent(arguments[x]);
    }
    return "Minified React error #" + b + "; visit " + v + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function i() {
  }
  var c = {
    d: {
      f: i,
      r: function() {
        throw Error(r(522));
      },
      D: i,
      C: i,
      L: i,
      m: i,
      X: i,
      S: i,
      M: i
    },
    p: 0,
    findDOMNode: null
  }, f = /* @__PURE__ */ Symbol.for("react.portal"), d = /* @__PURE__ */ Symbol.for("react.recoverable"), m = /* @__PURE__ */ Symbol.for("react.optimistic_key");
  function h(b, v, x) {
    var E = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: f,
      key: E == null ? null : E === m ? m : "" + E,
      children: b,
      containerInfo: v,
      implementation: x
    };
  }
  var g = o.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function w(b, v) {
    if (b === "font") return "";
    if (typeof v == "string") return v === "use-credentials" ? v : "";
  }
  n.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = c, n.browser = function(b) {
    return {
      $$typeof: d,
      _reason: b
    };
  }, n.createPortal = function(b, v) {
    var x = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!v || v.nodeType !== 1 && v.nodeType !== 9 && v.nodeType !== 11) throw Error(r(299));
    return h(b, v, null, x);
  }, n.flushSync = function(b) {
    var v = g.T, x = c.p;
    try {
      if (g.T = null, c.p = 2, b) return b();
    } finally {
      g.T = v, c.p = x, c.d.f();
    }
  }, n.preconnect = function(b, v) {
    typeof b == "string" && (v ? (v = v.crossOrigin, v = typeof v == "string" ? v === "use-credentials" ? v : "" : void 0) : v = null, c.d.C(b, v));
  }, n.prefetchDNS = function(b) {
    typeof b == "string" && c.d.D(b);
  }, n.preinit = function(b, v) {
    if (typeof b == "string" && v && typeof v.as == "string") {
      var x = v.as, E = w(x, v.crossOrigin), C = typeof v.integrity == "string" ? v.integrity : void 0, _ = typeof v.fetchPriority == "string" ? v.fetchPriority : void 0;
      x === "style" ? c.d.S(b, typeof v.precedence == "string" ? v.precedence : void 0, {
        crossOrigin: E,
        integrity: C,
        fetchPriority: _
      }) : x === "script" && c.d.X(b, {
        crossOrigin: E,
        integrity: C,
        fetchPriority: _,
        nonce: typeof v.nonce == "string" ? v.nonce : void 0
      });
    }
  }, n.preinitModule = function(b, v) {
    if (typeof b == "string") if (typeof v == "object" && v !== null) {
      if (v.as == null || v.as === "script") {
        var x = w(v.as, v.crossOrigin);
        c.d.M(b, {
          crossOrigin: x,
          integrity: typeof v.integrity == "string" ? v.integrity : void 0,
          nonce: typeof v.nonce == "string" ? v.nonce : void 0,
          fetchPriority: typeof v.fetchPriority == "string" ? v.fetchPriority : void 0
        });
      }
    } else v ?? c.d.M(b);
  }, n.preload = function(b, v) {
    if (typeof b == "string" && typeof v == "object" && v !== null && typeof v.as == "string") {
      var x = v.as, E = w(x, v.crossOrigin);
      c.d.L(b, x, {
        crossOrigin: E,
        integrity: typeof v.integrity == "string" ? v.integrity : void 0,
        nonce: typeof v.nonce == "string" ? v.nonce : void 0,
        type: typeof v.type == "string" ? v.type : void 0,
        fetchPriority: typeof v.fetchPriority == "string" ? v.fetchPriority : void 0,
        referrerPolicy: typeof v.referrerPolicy == "string" ? v.referrerPolicy : void 0,
        imageSrcSet: typeof v.imageSrcSet == "string" ? v.imageSrcSet : void 0,
        imageSizes: typeof v.imageSizes == "string" ? v.imageSizes : void 0,
        media: typeof v.media == "string" ? v.media : void 0
      });
    }
  }, n.preloadModule = function(b, v) {
    if (typeof b == "string") if (v) {
      var x = w(v.as, v.crossOrigin);
      c.d.m(b, {
        as: typeof v.as == "string" && v.as !== "script" ? v.as : void 0,
        crossOrigin: x,
        integrity: typeof v.integrity == "string" ? v.integrity : void 0,
        nonce: typeof v.nonce == "string" ? v.nonce : void 0,
        fetchPriority: typeof v.fetchPriority == "string" ? v.fetchPriority : void 0
      });
    } else c.d.m(b);
  }, n.requestFormReset = function(b) {
    c.d.r(b);
  }, n.unstable_batchedUpdates = function(b, v) {
    return b(v);
  }, n.useFormState = function(b, v, x) {
    return g.H.useFormState(b, v, x);
  }, n.useFormStatus = function() {
    return g.H.useHostTransitionStatus();
  }, n.version = "19.3.0";
})), Nb = /* @__PURE__ */ va(((n, o) => {
  function r() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r);
      } catch (i) {
        console.error(i);
      }
  }
  r(), o.exports = W2();
})), eE = /* @__PURE__ */ va(((n) => {
  var o = J2(), r = Zm(), i = Nb();
  function c(e) {
    var t = "https://react.dev/errors/" + e;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var a = 2; a < arguments.length; a++) t += "&args[]=" + encodeURIComponent(arguments[a]);
    }
    return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function f(e) {
    return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
  }
  function d(e) {
    for (var t = e, a = t; a && !a.alternate; ) t = a, (t.flags & 4098) !== 0 && (e = t.return), a = t.return;
    for (; t.return; ) t = t.return;
    return t.tag === 3 ? e : null;
  }
  function m(e) {
    if (e.tag === 13) {
      var t = e.memoizedState;
      if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
    }
    return null;
  }
  function h(e) {
    if (e.tag === 31) {
      var t = e.memoizedState;
      if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
    }
    return null;
  }
  function g(e) {
    if (d(e) !== e) throw Error(c(188));
  }
  function w(e) {
    var t = e.alternate;
    if (!t) {
      if (t = d(e), t === null) throw Error(c(188));
      return t !== e ? null : e;
    }
    for (var a = e, l = t; ; ) {
      var s = a.return;
      if (s === null) break;
      var u = s.alternate;
      if (u === null) {
        if (l = s.return, l !== null) {
          a = l;
          continue;
        }
        break;
      }
      if (s.child === u.child) {
        for (u = s.child; u; ) {
          if (u === a) return g(s), e;
          if (u === l) return g(s), t;
          u = u.sibling;
        }
        throw Error(c(188));
      }
      if (a.return !== l.return) a = s, l = u;
      else {
        for (var p = !1, T = s.child; T; ) {
          if (T === a) {
            p = !0, a = s, l = u;
            break;
          }
          if (T === l) {
            p = !0, l = s, a = u;
            break;
          }
          T = T.sibling;
        }
        if (!p) {
          for (T = u.child; T; ) {
            if (T === a) {
              p = !0, a = u, l = s;
              break;
            }
            if (T === l) {
              p = !0, l = u, a = s;
              break;
            }
            T = T.sibling;
          }
          if (!p) throw Error(c(189));
        }
      }
      if (a.alternate !== l) throw Error(c(190));
    }
    if (a.tag !== 3) throw Error(c(188));
    return a.stateNode.current === a ? e : t;
  }
  function b(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e;
    for (e = e.child; e !== null; ) {
      if (t = b(e), t !== null) return t;
      e = e.sibling;
    }
    return null;
  }
  function v(e, t, a, l, s, u) {
    for (; e !== null; ) {
      if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && a(e, l, s, u) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && v(e.child, t, a, l, s, u)) return !0;
      e = e.sibling;
    }
    return !1;
  }
  function x(e) {
    for (e = e.return; e !== null; ) {
      if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
      e = e.return;
    }
    return null;
  }
  function E(e) {
    var t = !1;
    for (e = e.return; e !== null && (e.tag === 4 && (t = !0), !(e.tag === 3 || e.tag === 5 || e.tag === 27)); )
      e = e.return;
    return t;
  }
  function C(e) {
    var t = [null, null], a = x(e);
    return a === null || _(t, e, a.child, { foundSelf: !1 }), t;
  }
  function _(e, t, a, l) {
    for (; a !== null; ) {
      if (a === t) l.foundSelf = !0;
      else if (a.tag === 5 || a.tag === 27 || a.tag === 6) {
        if (l.foundSelf) return e[1] = a, !0;
        e[0] = a;
      } else if ((a.tag !== 22 || a.memoizedState === null) && _(e, t, a.child, l)) return !0;
      a = a.sibling;
    }
    return !1;
  }
  function R(e) {
    switch (e.tag) {
      case 5:
      case 27:
      case 6:
        return e.stateNode;
      case 3:
        return e.stateNode.containerInfo;
      default:
        throw Error(c(559));
    }
  }
  var M = null, A = null;
  function O(e, t, a) {
    return e === a ? !0 : e === t ? (M = e, !0) : !1;
  }
  function D(e, t, a) {
    return e === a ? (A = e, !1) : e === t ? (A !== null && (M = e), !0) : !1;
  }
  function j(e) {
    if (e === null) return null;
    do
      e = e === null ? null : e.return;
    while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
    return e || null;
  }
  function $(e, t, a) {
    for (var l = 0, s = e; s; s = a(s)) l++;
    s = 0;
    for (var u = t; u; u = a(u)) s++;
    for (; 0 < l - s; ) e = a(e), l--;
    for (; 0 < s - l; ) t = a(t), s--;
    for (; l--; ) {
      if (e === t || t !== null && e === t.alternate) return e;
      e = a(e), t = a(t);
    }
    return null;
  }
  var H = Object.assign, X = /* @__PURE__ */ Symbol.for("react.element"), J = /* @__PURE__ */ Symbol.for("react.transitional.element"), W = /* @__PURE__ */ Symbol.for("react.portal"), ie = /* @__PURE__ */ Symbol.for("react.fragment"), ae = /* @__PURE__ */ Symbol.for("react.strict_mode"), q = /* @__PURE__ */ Symbol.for("react.profiler"), me = /* @__PURE__ */ Symbol.for("react.consumer"), B = /* @__PURE__ */ Symbol.for("react.context"), G = /* @__PURE__ */ Symbol.for("react.forward_ref"), k = /* @__PURE__ */ Symbol.for("react.suspense"), I = /* @__PURE__ */ Symbol.for("react.suspense_list"), ee = /* @__PURE__ */ Symbol.for("react.memo"), te = /* @__PURE__ */ Symbol.for("react.lazy"), ne = /* @__PURE__ */ Symbol.for("react.activity"), ce = /* @__PURE__ */ Symbol.for("react.legacy_hidden"), fe = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), N = /* @__PURE__ */ Symbol.for("react.view_transition"), Z = /* @__PURE__ */ Symbol.for("react.recoverable"), ue = Symbol.iterator;
  function re(e) {
    return e === null || typeof e != "object" ? null : (e = ue && e[ue] || e["@@iterator"], typeof e == "function" ? e : null);
  }
  var ge = /* @__PURE__ */ Symbol.for("react.client.reference");
  function he(e) {
    if (e == null) return null;
    if (typeof e == "function") return e.$$typeof === ge ? null : e.displayName || e.name || null;
    if (typeof e == "string") return e;
    switch (e) {
      case ie:
        return "Fragment";
      case q:
        return "Profiler";
      case ae:
        return "StrictMode";
      case k:
        return "Suspense";
      case I:
        return "SuspenseList";
      case ne:
        return "Activity";
      case N:
        return "ViewTransition";
    }
    if (typeof e == "object") switch (e.$$typeof) {
      case W:
        return "Portal";
      case B:
        return e.displayName || "Context";
      case me:
        return (e._context.displayName || "Context") + ".Consumer";
      case G:
        var t = e.render;
        return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
      case ee:
        return t = e.displayName || null, t !== null ? t : he(e.type) || "Memo";
      case te:
        t = e._payload, e = e._init;
        try {
          return he(e(t));
        } catch {
        }
    }
    return null;
  }
  var ye = Array.isArray, ve = r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, de = i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Ne = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, Q = [], Se = -1;
  function _e(e) {
    return { current: e };
  }
  function Ae(e) {
    0 > Se || (e.current = Q[Se], Q[Se] = null, Se--);
  }
  function Oe(e, t) {
    Se++, Q[Se] = e.current, e.current = t;
  }
  var We = _e(null), ct = _e(null), tt = _e(null), xt = _e(null);
  function Ye(e, t) {
    switch (Oe(tt, t), Oe(ct, e), Oe(We, null), t.nodeType) {
      case 9:
      case 11:
        e = (e = t.documentElement) && (e = e.namespaceURI) ? jg(e) : 0;
        break;
      default:
        if (e = t.tagName, t = t.namespaceURI) t = jg(t), e = Dg(t, e);
        else switch (e) {
          case "svg":
            e = 1;
            break;
          case "math":
            e = 2;
            break;
          default:
            e = 0;
        }
    }
    Ae(We), Oe(We, e);
  }
  function Vt() {
    Ae(We), Ae(ct), Ae(tt);
  }
  function qe(e) {
    var t = e.memoizedState;
    t !== null && (rr._currentValue = t.memoizedState, Oe(xt, e)), t = We.current;
    var a = Dg(t, e.type);
    t !== a && (Oe(ct, e), Oe(We, a));
  }
  function ga(e) {
    ct.current === e && (Ae(We), Ae(ct)), xt.current === e && (Ae(xt), rr._currentValue = Ne);
  }
  var Xe, Ft;
  function Cn(e) {
    if (Xe === void 0) try {
      throw Error();
    } catch (a) {
      var t = a.stack.trim().match(/\n( *(at )?)/);
      Xe = t && t[1] || "", Ft = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
    }
    return `
` + Xe + e + Ft;
  }
  var cn = !1;
  function bl(e, t) {
    if (!e || cn) return "";
    cn = !0;
    var a = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = { DetermineComponentFrameRoot: function() {
        try {
          if (t) {
            var le = function() {
              throw Error();
            };
            if (Object.defineProperty(le.prototype, "props", { set: function() {
              throw Error();
            } }), typeof Reflect == "object" && Reflect.construct) {
              try {
                Reflect.construct(le, []);
              } catch (be) {
                var U = be;
              }
              Reflect.construct(e, [], le);
            } else {
              try {
                le.call();
              } catch (be) {
                U = be;
              }
              le = !1;
              try {
                var K = Object.getOwnPropertyDescriptor(e.prototype, "props");
                Object.defineProperty(e.prototype, "props", {
                  configurable: !0,
                  set: function() {
                    throw Error();
                  }
                }), le = !0, new e();
              } finally {
                le && (K !== void 0 ? Object.defineProperty(e.prototype, "props", K) : delete e.prototype.props);
              }
            }
          } else {
            try {
              throw Error();
            } catch (be) {
              U = be;
            }
            (le = e()) && typeof le.catch == "function" && le.catch(function() {
            });
          }
        } catch (be) {
          if (be && U && typeof be.stack == "string") return [be.stack, U.stack];
        }
        return [null, null];
      } };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var s = Object.getOwnPropertyDescriptor(l.DetermineComponentFrameRoot, "name");
      s && s.configurable && Object.defineProperty(l.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
      var u = l.DetermineComponentFrameRoot(), p = u[0], T = u[1];
      if (p && T) {
        var z = p.split(`
`), Y = T.split(`
`);
        for (s = l = 0; l < z.length && !z[l].includes("DetermineComponentFrameRoot"); ) l++;
        for (; s < Y.length && !Y[s].includes("DetermineComponentFrameRoot"); ) s++;
        if (l === z.length || s === Y.length) for (l = z.length - 1, s = Y.length - 1; 1 <= l && 0 <= s && z[l] !== Y[s]; ) s--;
        for (; 1 <= l && 0 <= s; l--, s--) if (z[l] !== Y[s]) {
          if (l !== 1 || s !== 1) do
            if (l--, s--, 0 > s || z[l] !== Y[s]) {
              var F = `
` + z[l].replace(" at new ", " at ");
              return e.displayName && F.includes("<anonymous>") && (F = F.replace("<anonymous>", e.displayName)), F;
            }
          while (1 <= l && 0 <= s);
          break;
        }
      }
    } finally {
      cn = !1, Error.prepareStackTrace = a;
    }
    return (a = e ? e.displayName || e.name : "") ? Cn(a) : "";
  }
  function Sl(e, t) {
    switch (e.tag) {
      case 26:
      case 27:
      case 5:
        return Cn(e.type);
      case 16:
        return Cn("Lazy");
      case 13:
        return e.child !== t && t !== null ? Cn("Suspense Fallback") : Cn("Suspense");
      case 19:
        return Cn("SuspenseList");
      case 0:
      case 15:
        return bl(e.type, !1);
      case 11:
        return bl(e.type.render, !1);
      case 1:
        return bl(e.type, !0);
      case 31:
        return Cn("Activity");
      case 30:
        return Cn("ViewTransition");
      default:
        return "";
    }
  }
  function Ki(e) {
    try {
      var t = "", a = null;
      do
        t += Sl(e, a), a = e, e = e.return;
      while (e);
      return t;
    } catch (l) {
      return `
Error generating stack: ` + l.message + `
` + l.stack;
    }
  }
  var _r = Object.prototype.hasOwnProperty, _t = o.unstable_scheduleCallback, En = o.unstable_cancelCallback, Fi = o.unstable_shouldYield, Ji = o.unstable_requestPaint, Yt = o.unstable_now, Nu = o.unstable_getCurrentPriorityLevel, wt = o.unstable_ImmediatePriority, Ut = o.unstable_UserBlockingPriority, Fa = o.unstable_NormalPriority, iw = o.unstable_LowPriority, lv = o.unstable_IdlePriority, sw = o.log, cw = o.unstable_setDisableYieldValue, Rr = null, un = null;
  function Ja(e) {
    if (typeof sw == "function" && cw(e), un && typeof un.setStrictMode == "function") try {
      un.setStrictMode(Rr, e);
    } catch {
    }
  }
  var fn = Math.clz32 ? Math.clz32 : dw, uw = Math.log, fw = Math.LN2;
  function dw(e) {
    return e >>>= 0, e === 0 ? 32 : 31 - (uw(e) / fw | 0) | 0;
  }
  var Wi = 256, es = 262144, ts = 4194304;
  function Bo(e) {
    var t = e & 42;
    if (t !== 0) return t;
    switch (e & -e) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return e & -e;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return e & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return e;
    }
  }
  function ns(e, t, a) {
    var l = e.pendingLanes;
    if (l === 0) return 0;
    var s = 0, u = e.suspendedLanes, p = e.pingedLanes;
    e = e.warmLanes;
    var T = l & 134217727;
    return T !== 0 ? (l = T & ~u, l !== 0 ? s = Bo(l) : (p &= T, p !== 0 ? s = Bo(p) : a || (a = T & ~e, a !== 0 && (s = Bo(a))))) : (T = l & ~u, T !== 0 ? s = Bo(T) : p !== 0 ? s = Bo(p) : a || (a = l & ~e, a !== 0 && (s = Bo(a)))), s === 0 ? 0 : t !== 0 && t !== s && (t & u) === 0 && (u = s & -s, a = t & -t, u >= a || u === 32 && (a & 4194048) !== 0) ? t : s;
  }
  function Ar(e, t) {
    return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
  }
  function rv(e, t) {
    (t & 8) !== 0 && (t |= t & 32);
    var a = e.entangledLanes;
    if (a !== 0) for (e = e.entanglements, a &= t; 0 < a; ) {
      var l = 31 - fn(a), s = 1 << l;
      t |= e[l], a &= ~s;
    }
    return t;
  }
  function mw(e, t) {
    switch (e) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return t + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function iv() {
    var e = ts;
    return ts <<= 1, (ts & 62914560) === 0 && (ts = 4194304), e;
  }
  function Ou(e) {
    for (var t = [], a = 0; 31 > a; a++) t.push(e);
    return t;
  }
  function as(e, t) {
    e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
  }
  function hw(e, t, a, l, s, u) {
    var p = e.pendingLanes;
    e.pendingLanes = a, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= a, e.entangledLanes &= a, e.errorRecoveryDisabledLanes &= a, e.shellSuspendCounter = 0;
    var T = e.entanglements, z = e.expirationTimes, Y = e.hiddenUpdates;
    for (a = p & ~a; 0 < a; ) {
      var F = 31 - fn(a), le = 1 << F;
      T[F] = 0, z[F] = -1;
      var U = Y[F];
      if (U !== null) for (Y[F] = null, F = 0; F < U.length; F++) {
        var K = U[F];
        K !== null && (K.lane &= -536870913);
      }
      a &= ~le;
    }
    l !== 0 && sv(e, l, 0), u !== 0 && s === 0 && e.tag !== 0 && (e.suspendedLanes |= u & ~(p & ~t));
  }
  function sv(e, t, a) {
    e.pendingLanes |= t, e.suspendedLanes &= ~t;
    var l = 31 - fn(t);
    e.entangledLanes |= t, e.entanglements[l] = e.entanglements[l] | 1073741824 | a & 261930;
  }
  function cv(e, t) {
    var a = e.entangledLanes |= t;
    for (e = e.entanglements; a; ) {
      var l = 31 - fn(a), s = 1 << l;
      s & t | e[l] & t && (e[l] |= t), a &= ~s;
    }
  }
  function uv(e, t) {
    var a = t & -t;
    return a = (a & 42) !== 0 ? 1 : fv(a), (a & (e.suspendedLanes | t)) !== 0 ? 0 : a;
  }
  function fv(e) {
    switch (e) {
      case 2:
        e = 1;
        break;
      case 8:
        e = 4;
        break;
      case 32:
        e = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        e = 128;
        break;
      case 268435456:
        e = 134217728;
        break;
      default:
        e = 0;
    }
    return e;
  }
  function Mu(e) {
    return e &= -e, 2 < e ? 8 < e ? (e & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function dv() {
    var e = de.p;
    return e !== 0 ? e : (e = window.event, e === void 0 ? 32 : py(e.type));
  }
  function mv(e, t) {
    var a = de.p;
    try {
      return de.p = e, t();
    } finally {
      de.p = a;
    }
  }
  var ya = Math.random().toString(36).slice(2), zt = "__reactFiber$" + ya, Jt = "__reactProps$" + ya, Nr = "__reactContainer$" + ya, hv = "__reactEvents$" + ya, vw = "__reactListeners$" + ya, pw = "__reactHandles$" + ya, vv = "__reactResources$" + ya, Or = "__reactMarker$" + ya, os = "__reactLoad$" + ya;
  function ls(e) {
    delete e[zt], delete e[Jt], delete e[vw], delete e[pw];
  }
  function Ho(e) {
    var t;
    if (t = e[zt]) return t;
    for (var a = e.parentNode; a; ) {
      if (t = a[Nr] || a[zt]) {
        if (a = t.alternate, t.child !== null || a !== null && a.child !== null) for (e = Jg(e); e !== null; ) {
          if (a = e[zt]) return a;
          e = Jg(e);
        }
        return t;
      }
      e = a, a = e.parentNode;
    }
    return null;
  }
  function xl(e) {
    if (e = e[zt] || e[Nr]) {
      var t = e.tag;
      if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
    }
    return null;
  }
  function Mr(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
    throw Error(c(33));
  }
  function wl(e) {
    var t = e[vv];
    return t || (t = e[vv] = {
      hoistableStyles: /* @__PURE__ */ new Map(),
      hoistableScripts: /* @__PURE__ */ new Map()
    }), t;
  }
  function Rt(e) {
    e[Or] = !0;
  }
  function pv(e) {
    e[os] = void 0;
  }
  var gv = /* @__PURE__ */ new Set(), yv = {};
  function ko(e, t) {
    Cl(e, t), Cl(e + "Capture", t);
  }
  function Cl(e, t) {
    for (yv[e] = t, e = 0; e < t.length; e++) gv.add(t[e]);
  }
  var gw = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), bv = {}, Sv = {};
  function yw(e) {
    return _r.call(Sv, e) ? !0 : _r.call(bv, e) ? !1 : gw.test(e) ? Sv[e] = !0 : (bv[e] = !0, !1);
  }
  var Ve = !1;
  function xv() {
    var e = Ve;
    return Ve = !1, e;
  }
  function rs(e, t, a) {
    if (yw(t)) if (a === null) e.removeAttribute(t);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
          e.removeAttribute(t);
          return;
        case "boolean":
          var l = t.toLowerCase().slice(0, 5);
          if (l !== "data-" && l !== "aria-") {
            e.removeAttribute(t);
            return;
          }
      }
      e.setAttribute(t, a);
    }
  }
  function is(e, t, a) {
    if (a === null) e.removeAttribute(t);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(t);
          return;
      }
      e.setAttribute(t, a);
    }
  }
  function ba(e, t, a, l) {
    if (l === null) e.removeAttribute(a);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(a);
          return;
      }
      e.setAttributeNS(t, a, l);
    }
  }
  function dn(e) {
    switch (typeof e) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return e;
      case "object":
        return e;
      default:
        return "";
    }
  }
  function wv(e) {
    var t = e.type;
    return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
  }
  function bw(e, t, a) {
    var l = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
    if (!e.hasOwnProperty(t) && typeof l < "u" && typeof l.get == "function" && typeof l.set == "function") {
      var s = l.get, u = l.set;
      return Object.defineProperty(e, t, {
        configurable: !0,
        get: function() {
          return s.call(this);
        },
        set: function(p) {
          a = "" + p, u.call(this, p);
        }
      }), Object.defineProperty(e, t, { enumerable: l.enumerable }), {
        getValue: function() {
          return a;
        },
        setValue: function(p) {
          a = "" + p;
        },
        stopTracking: function() {
          e._valueTracker = null, delete e[t];
        }
      };
    }
  }
  function zu(e) {
    if (!e._valueTracker) {
      var t = wv(e) ? "checked" : "value";
      e._valueTracker = bw(e, t, "" + e[t]);
    }
  }
  function Cv(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var a = t.getValue(), l = "";
    return e && (l = wv(e) ? e.checked ? "true" : "false" : e.value), e = l, e !== a ? (t.setValue(e), !0) : !1;
  }
  var Sw = /[\n"\\]/g;
  function Tn(e) {
    return e.replace(Sw, function(t) {
      return "\\" + t.charCodeAt(0).toString(16) + " ";
    });
  }
  function ju(e, t, a, l, s, u, p, T) {
    e.name = "", p != null && typeof p != "function" && typeof p != "symbol" && typeof p != "boolean" ? e.type = p : e.removeAttribute("type"), t != null ? p === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + dn(t)) : e.value !== "" + dn(t) && (e.value = "" + dn(t)) : p !== "submit" && p !== "reset" || e.removeAttribute("value"), t != null ? p === "number" && e.value == t ? Du(e, dn(e.value)) : Du(e, dn(t)) : a != null ? Du(e, dn(a)) : l != null && e.removeAttribute("value"), s == null && u != null && (e.defaultChecked = !!u), s != null && (e.checked = s && typeof s != "function" && typeof s != "symbol"), T != null && typeof T != "function" && typeof T != "symbol" && typeof T != "boolean" ? e.name = "" + dn(T) : e.removeAttribute("name");
  }
  function Ev(e, t, a, l, s, u, p, T) {
    if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (e.type = u), t != null || a != null) {
      if (!(u !== "submit" && u !== "reset" || t != null)) {
        zu(e);
        return;
      }
      a = a != null ? "" + dn(a) : "", t = t != null ? "" + dn(t) : a, T || t === e.value || (e.value = t), e.defaultValue = t;
    }
    l = l ?? s, l = typeof l != "function" && typeof l != "symbol" && !!l, e.checked = T ? e.checked : !!l, e.defaultChecked = !!l, p != null && typeof p != "function" && typeof p != "symbol" && typeof p != "boolean" && (e.name = p), zu(e);
  }
  function Du(e, t) {
    e.defaultValue !== "" + t && (e.defaultValue = "" + t);
  }
  function El(e, t, a, l) {
    if (e = e.options, t) {
      t = {};
      for (var s = 0; s < a.length; s++) t["$" + a[s]] = !0;
      for (a = 0; a < e.length; a++) s = t.hasOwnProperty("$" + e[a].value), e[a].selected !== s && (e[a].selected = s), s && l && (e[a].defaultSelected = !0);
    } else {
      for (a = "" + dn(a), t = null, s = 0; s < e.length; s++) {
        if (e[s].value === a) {
          e[s].selected = !0, l && (e[s].defaultSelected = !0);
          return;
        }
        t !== null || e[s].disabled || (t = e[s]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function Tv(e, t, a) {
    if (t != null && (t = "" + dn(t), t !== e.value && (e.value = t), a == null)) {
      e.defaultValue !== t && (e.defaultValue = t);
      return;
    }
    e.defaultValue = a != null ? "" + dn(a) : "";
  }
  function _v(e, t, a, l) {
    if (t == null) {
      if (l != null) {
        if (a != null) throw Error(c(92));
        if (ye(l)) {
          if (1 < l.length) throw Error(c(93));
          l = l[0];
        }
        a = l;
      }
      a ??= "", t = a;
    }
    a = dn(t), e.defaultValue = a, l = e.textContent, l === a && l !== "" && l !== null && (e.value = l), zu(e);
  }
  function Tl(e, t) {
    if (t) {
      var a = e.firstChild;
      if (a && a === e.lastChild && a.nodeType === 3) {
        a.nodeValue = t;
        return;
      }
    }
    e.textContent = t;
  }
  var xw = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
  function Rv(e, t, a) {
    var l = t.indexOf("--") === 0;
    a == null || typeof a == "boolean" || a === "" ? l ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : l ? e.setProperty(t, a) : typeof a != "number" || a === 0 || xw.has(t) ? t === "float" ? e.cssFloat = a : e[t] = ("" + a).trim() : e[t] = a + "px";
  }
  function Av(e, t, a) {
    if (t != null && typeof t != "object") throw Error(c(62));
    if (e = e.style, a != null) {
      for (var l in a) !a.hasOwnProperty(l) || t != null && t.hasOwnProperty(l) || (l.indexOf("--") === 0 ? e.setProperty(l, "") : l === "float" ? e.cssFloat = "" : e[l] = "", Ve = !0);
      for (var s in t) l = t[s], t.hasOwnProperty(s) && a[s] !== l && (Rv(e, s, l), Ve = !0);
    } else for (var u in t) t.hasOwnProperty(u) && Rv(e, u, t[u]);
  }
  function Lu(e) {
    if (e.indexOf("-") === -1) return !1;
    switch (e) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var ww = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["maskType", "mask-type"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), Cw = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function ss(e) {
    return Cw.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
  }
  function Jn() {
  }
  var Bu = null;
  function Hu(e) {
    return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
  }
  var _l = null, Rl = null;
  function Nv(e) {
    var t = xl(e);
    if (t && (e = t.stateNode)) {
      var a = e[Jt] || null;
      e: switch (e = t.stateNode, t.type) {
        case "input":
          if (ju(e, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name), t = a.name, a.type === "radio" && t != null) {
            for (a = e; a.parentNode; ) a = a.parentNode;
            for (a = a.querySelectorAll('input[name="' + Tn("" + t) + '"][type="radio"]'), t = 0; t < a.length; t++) {
              var l = a[t];
              if (l !== e && l.form === e.form) {
                var s = l[Jt] || null;
                if (!s) throw Error(c(90));
                ju(l, s.value, s.defaultValue, s.defaultValue, s.checked, s.defaultChecked, s.type, s.name);
              }
            }
            for (t = 0; t < a.length; t++) l = a[t], l.form === e.form && Cv(l);
          }
          break e;
        case "textarea":
          Tv(e, a.value, a.defaultValue);
          break e;
        case "select":
          t = a.value, t != null && El(e, !!a.multiple, t, !1);
      }
    }
  }
  var ku = !1;
  function Ov(e, t, a) {
    if (ku) return e(t, a);
    ku = !0;
    try {
      return e(t);
    } finally {
      if (ku = !1, (_l !== null || Rl !== null) && (sc(), _l && (t = _l, e = Rl, Rl = _l = null, Nv(t), e)))
        for (t = 0; t < e.length; t++) Nv(e[t]);
    }
  }
  function zr(e, t) {
    var a = e.stateNode;
    if (a === null) return null;
    var l = a[Jt] || null;
    if (l === null) return null;
    a = l[t];
    e: switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (l = !l.disabled) || (e = e.type, l = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !l;
        break e;
      default:
        e = !1;
    }
    if (e) return null;
    if (a && typeof a != "function") throw Error(c(231, t, typeof a));
    return a;
  }
  var Sa = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Uu = !1;
  if (Sa) try {
    var jr = {};
    Object.defineProperty(jr, "passive", { get: function() {
      Uu = !0;
    } }), window.addEventListener("test", jr, jr), window.removeEventListener("test", jr, jr);
  } catch {
    Uu = !1;
  }
  var Wa = null, $u = null, cs = null;
  function Mv() {
    if (cs) return cs;
    var e, t = $u, a = t.length, l, s = "value" in Wa ? Wa.value : Wa.textContent, u = s.length;
    for (e = 0; e < a && t[e] === s[e]; e++) ;
    var p = a - e;
    for (l = 1; l <= p && t[a - l] === s[u - l]; l++) ;
    return cs = s.slice(e, 1 < l ? 1 - l : void 0);
  }
  function us(e) {
    var t = e.keyCode;
    return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
  }
  function fs() {
    return !0;
  }
  function zv() {
    return !1;
  }
  function qt(e) {
    function t(a, l, s, u, p) {
      this._reactName = a, this._targetInst = s, this.type = l, this.nativeEvent = u, this.target = p, this.currentTarget = null;
      for (var T in e) e.hasOwnProperty(T) && (a = e[T], this[T] = a ? a(u) : u[T]);
      return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1) ? fs : zv, this.isPropagationStopped = zv, this;
    }
    return H(t.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var a = this.nativeEvent;
        a && (a.preventDefault ? a.preventDefault() : typeof a.returnValue != "unknown" && (a.returnValue = !1), this.isDefaultPrevented = fs);
      },
      stopPropagation: function() {
        var a = this.nativeEvent;
        a && (a.stopPropagation ? a.stopPropagation() : typeof a.cancelBubble != "unknown" && (a.cancelBubble = !0), this.isPropagationStopped = fs);
      },
      persist: function() {
      },
      isPersistent: fs
    }), t;
  }
  var eo = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(e) {
      return e.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, ds = qt(eo), Dr = H({}, eo, {
    view: 0,
    detail: 0
  }), Ew = qt(Dr), Vu, Yu, Lr, ms = H({}, Dr, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: Gu,
    button: 0,
    buttons: 0,
    relatedTarget: function(e) {
      return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
    },
    movementX: function(e) {
      return "movementX" in e ? e.movementX : (e !== Lr && (Lr && e.type === "mousemove" ? (Vu = e.screenX - Lr.screenX, Yu = e.screenY - Lr.screenY) : Yu = Vu = 0, Lr = e), Vu);
    },
    movementY: function(e) {
      return "movementY" in e ? e.movementY : Yu;
    }
  }), jv = qt(ms), Tw = qt(H({}, ms, { dataTransfer: 0 })), qu = qt(H({}, Dr, { relatedTarget: 0 })), _w = qt(H({}, eo, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  })), Rw = qt(H({}, eo, { clipboardData: function(e) {
    return "clipboardData" in e ? e.clipboardData : window.clipboardData;
  } })), Dv = qt(H({}, eo, { data: 0 })), Aw = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, Nw = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, Ow = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function Mw(e) {
    var t = this.nativeEvent;
    return t.getModifierState ? t.getModifierState(e) : (e = Ow[e]) ? !!t[e] : !1;
  }
  function Gu() {
    return Mw;
  }
  var zw = qt(H({}, Dr, {
    key: function(e) {
      if (e.key) {
        var t = Aw[e.key] || e.key;
        if (t !== "Unidentified") return t;
      }
      return e.type === "keypress" ? (e = us(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Nw[e.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: Gu,
    charCode: function(e) {
      return e.type === "keypress" ? us(e) : 0;
    },
    keyCode: function(e) {
      return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    },
    which: function(e) {
      return e.type === "keypress" ? us(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
    }
  })), Lv = qt(H({}, ms, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  })), jw = qt(H({}, eo, { submitter: 0 })), Dw = qt(H({}, Dr, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: Gu
  })), Lw = qt(H({}, eo, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  })), Bw = qt(H({}, ms, {
    deltaX: function(e) {
      return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
    },
    deltaY: function(e) {
      return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  })), Hw = qt(H({}, eo, {
    newState: 0,
    oldState: 0,
    source: 0
  })), kw = [
    9,
    13,
    27,
    32
  ], Pu = Sa && "CompositionEvent" in window, Br = null;
  Sa && "documentMode" in document && (Br = document.documentMode);
  var Uw = Sa && "TextEvent" in window && !Br, Bv = Sa && (!Pu || Br && 8 < Br && 11 >= Br), Hv = " ", kv = !1;
  function Uv(e, t) {
    switch (e) {
      case "keyup":
        return kw.indexOf(t.keyCode) !== -1;
      case "keydown":
        return t.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function $v(e) {
    return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
  }
  var Al = !1;
  function $w(e, t) {
    switch (e) {
      case "compositionend":
        return $v(t);
      case "keypress":
        return t.which !== 32 ? null : (kv = !0, Hv);
      case "textInput":
        return e = t.data, e === Hv && kv ? null : e;
      default:
        return null;
    }
  }
  function Vw(e, t) {
    if (Al) return e === "compositionend" || !Pu && Uv(e, t) ? (e = Mv(), cs = $u = Wa = null, Al = !1, e) : null;
    switch (e) {
      case "paste":
        return null;
      case "keypress":
        if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
          if (t.char && 1 < t.char.length) return t.char;
          if (t.which) return String.fromCharCode(t.which);
        }
        return null;
      case "compositionend":
        return Bv && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var Yw = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
  };
  function Vv(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === "input" ? !!Yw[e.type] : t === "textarea";
  }
  function Yv(e, t, a, l) {
    _l ? Rl ? Rl.push(l) : Rl = [l] : _l = l, t = hc(t, "onChange"), 0 < t.length && (a = new ds("onChange", "change", null, a, l), e.push({
      event: a,
      listeners: t
    }));
  }
  var Hr = null, kr = null;
  function qw(e) {
    _g(e, 0);
  }
  function hs(e) {
    if (Cv(Mr(e))) return e;
  }
  function qv(e, t) {
    if (e === "change") return t;
  }
  var Gv = !1;
  if (Sa) {
    var Xu;
    if (Sa) {
      var Iu = "oninput" in document;
      if (!Iu) {
        var Pv = document.createElement("div");
        Pv.setAttribute("oninput", "return;"), Iu = typeof Pv.oninput == "function";
      }
      Xu = Iu;
    } else Xu = !1;
    Gv = Xu && (!document.documentMode || 9 < document.documentMode);
  }
  function Xv() {
    Hr && (Hr.detachEvent("onpropertychange", Iv), kr = Hr = null);
  }
  function Iv(e) {
    if (e.propertyName === "value" && hs(kr)) {
      var t = [];
      Yv(t, kr, e, Hu(e)), Ov(qw, t);
    }
  }
  function Gw(e, t, a) {
    e === "focusin" ? (Xv(), Hr = t, kr = a, Hr.attachEvent("onpropertychange", Iv)) : e === "focusout" && Xv();
  }
  function Pw(e) {
    if (e === "selectionchange" || e === "keyup" || e === "keydown") return hs(kr);
  }
  function Xw(e, t) {
    if (e === "click") return hs(t);
  }
  function Iw(e, t) {
    if (e === "input" || e === "change") return hs(t);
  }
  function Qw(e, t) {
    return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
  }
  var mn = typeof Object.is == "function" ? Object.is : Qw;
  function Ur(e, t) {
    if (mn(e, t)) return !0;
    if (typeof e != "object" || e === null || typeof t != "object" || t === null) return !1;
    var a = Object.keys(e), l = Object.keys(t);
    if (a.length !== l.length) return !1;
    for (l = 0; l < a.length; l++) {
      var s = a[l];
      if (!_r.call(t, s) || !mn(e[s], t[s])) return !1;
    }
    return !0;
  }
  function Qu(e) {
    if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
    try {
      return e.activeElement || e.body;
    } catch {
      return e.body;
    }
  }
  function Qv(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
  }
  function Zv(e, t) {
    var a = Qv(e);
    e = 0;
    for (var l; a; ) {
      if (a.nodeType === 3) {
        if (l = e + a.textContent.length, e <= t && l >= t) return {
          node: a,
          offset: t - e
        };
        e = l;
      }
      e: {
        for (; a; ) {
          if (a.nextSibling) {
            a = a.nextSibling;
            break e;
          }
          a = a.parentNode;
        }
        a = void 0;
      }
      a = Qv(a);
    }
  }
  function Kv(e, t) {
    return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Kv(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
  }
  function Fv(e) {
    e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
    for (var t = Qu(e.document); t instanceof e.HTMLIFrameElement; ) {
      try {
        var a = typeof t.contentWindow.location.href == "string";
      } catch {
        a = !1;
      }
      if (a) e = t.contentWindow;
      else break;
      t = Qu(e.document);
    }
    return t;
  }
  function Zu(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
  }
  var Zw = Sa && "documentMode" in document && 11 >= document.documentMode, Nl = null, Ku = null, $r = null, Fu = !1;
  function Jv(e, t, a) {
    var l = a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
    Fu || Nl == null || Nl !== Qu(l) || (l = Nl, "selectionStart" in l && Zu(l) ? l = {
      start: l.selectionStart,
      end: l.selectionEnd
    } : (l = (l.ownerDocument && l.ownerDocument.defaultView || window).getSelection(), l = {
      anchorNode: l.anchorNode,
      anchorOffset: l.anchorOffset,
      focusNode: l.focusNode,
      focusOffset: l.focusOffset
    }), $r && Ur($r, l) || ($r = l, l = hc(Ku, "onSelect"), 0 < l.length && (t = new ds("onSelect", "select", null, t, a), e.push({
      event: t,
      listeners: l
    }), t.target = Nl)));
  }
  function Uo(e, t) {
    var a = {};
    return a[e.toLowerCase()] = t.toLowerCase(), a["Webkit" + e] = "webkit" + t, a["Moz" + e] = "moz" + t, a;
  }
  var Ol = {
    animationend: Uo("Animation", "AnimationEnd"),
    animationiteration: Uo("Animation", "AnimationIteration"),
    animationstart: Uo("Animation", "AnimationStart"),
    transitionrun: Uo("Transition", "TransitionRun"),
    transitionstart: Uo("Transition", "TransitionStart"),
    transitioncancel: Uo("Transition", "TransitionCancel"),
    transitionend: Uo("Transition", "TransitionEnd")
  }, Ju = {}, Wv = {};
  Sa && (Wv = document.createElement("div").style, "AnimationEvent" in window || (delete Ol.animationend.animation, delete Ol.animationiteration.animation, delete Ol.animationstart.animation), "TransitionEvent" in window || delete Ol.transitionend.transition);
  function $o(e) {
    if (Ju[e]) return Ju[e];
    if (!Ol[e]) return e;
    var t = Ol[e], a;
    for (a in t) if (t.hasOwnProperty(a) && a in Wv) return Ju[e] = t[a];
    return e;
  }
  var e0 = $o("animationend"), t0 = $o("animationiteration"), n0 = $o("animationstart"), Kw = $o("transitionrun"), Fw = $o("transitionstart"), Jw = $o("transitioncancel"), a0 = $o("transitionend"), o0 = /* @__PURE__ */ new Map(), Wu = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
  Wu.push("scrollEnd");
  function Un(e, t) {
    o0.set(e, t), ko(t, [e]);
  }
  var Ww = 0;
  function xa(e, t) {
    if (e.name != null && e.name !== "auto") return e.name;
    if (t.autoName !== null) return t.autoName;
    e = qn.identifierPrefix;
    var a = Ww++;
    return e = "_" + e + "t_" + a.toString(32) + "_", t.autoName = e;
  }
  function l0(e) {
    if (e == null || typeof e == "string") return e;
    var t = null, a = Kl;
    if (a !== null) for (var l = 0; l < a.length; l++) {
      var s = e[a[l]];
      if (s != null) {
        if (s === "none") return "none";
        t = t == null ? s : t + (" " + s);
      }
    }
    return t ?? e.default;
  }
  function wa(e, t) {
    return e = l0(e), t = l0(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
  }
  var vs = typeof reportError == "function" ? reportError : function(e) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var t = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof e == "object" && e !== null && typeof e.message == "string" ? String(e.message) : String(e),
        error: e
      });
      if (!window.dispatchEvent(t)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", e);
      return;
    }
    console.error(e);
  }, _n = [], Ml = 0, ef = 0;
  function ps() {
    for (var e = Ml, t = ef = Ml = 0; t < e; ) {
      var a = _n[t];
      _n[t++] = null;
      var l = _n[t];
      _n[t++] = null;
      var s = _n[t];
      _n[t++] = null;
      var u = _n[t];
      if (_n[t++] = null, l !== null && s !== null) {
        var p = l.pending;
        p === null ? s.next = s : (s.next = p.next, p.next = s), l.pending = s;
      }
      u !== 0 && r0(a, s, u);
    }
  }
  function gs(e, t, a, l) {
    _n[Ml++] = e, _n[Ml++] = t, _n[Ml++] = a, _n[Ml++] = l, ef |= l, e.lanes |= l, e = e.alternate, e !== null && (e.lanes |= l);
  }
  function tf(e, t, a, l) {
    return gs(e, t, a, l), ys(e);
  }
  function Vo(e, t) {
    return gs(e, null, null, t), ys(e);
  }
  function r0(e, t, a) {
    e.lanes |= a;
    var l = e.alternate;
    l !== null && (l.lanes |= a);
    for (var s = !1, u = e.return; u !== null; ) u.childLanes |= a, l = u.alternate, l !== null && (l.childLanes |= a), u.tag === 22 && (e = u.stateNode, e === null || e._visibility & 1 || (s = !0)), e = u, u = u.return;
    return e.tag === 3 ? (u = e.stateNode, s && t !== null && (s = 31 - fn(a), e = u.hiddenUpdates, l = e[s], l === null ? e[s] = [t] : l.push(t), t.lane = a | 536870912), u) : null;
  }
  function ys(e) {
    if (50 < si) throw si = 0, ic = null, Error(c(185));
    for (var t = e.return; t !== null; ) e = t, t = e.return;
    return e.tag === 3 ? e.stateNode : null;
  }
  var zl = {};
  function eC(e, t, a, l) {
    this.tag = e, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function Wt(e, t, a, l) {
    return new eC(e, t, a, l);
  }
  function nf(e) {
    return e = e.prototype, !(!e || !e.isReactComponent);
  }
  function Ca(e, t) {
    var a = e.alternate;
    return a === null ? (a = Wt(e.tag, t, e.key, e.mode), a.elementType = e.elementType, a.type = e.type, a.stateNode = e.stateNode, a.alternate = e, e.alternate = a) : (a.pendingProps = t, a.type = e.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = e.flags & 1206910976, a.childLanes = e.childLanes, a.lanes = e.lanes, a.child = e.child, a.memoizedProps = e.memoizedProps, a.memoizedState = e.memoizedState, a.updateQueue = e.updateQueue, t = e.dependencies, a.dependencies = t === null ? null : {
      lanes: t.lanes,
      firstContext: t.firstContext
    }, a.sibling = e.sibling, a.index = e.index, a.ref = e.ref, a.refCleanup = e.refCleanup, a;
  }
  function i0(e, t) {
    e.flags &= 1206910978;
    var a = e.alternate;
    return a === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = a.childLanes, e.lanes = a.lanes, e.child = a.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = a.memoizedProps, e.memoizedState = a.memoizedState, e.updateQueue = a.updateQueue, e.type = a.type, t = a.dependencies, e.dependencies = t === null ? null : {
      lanes: t.lanes,
      firstContext: t.firstContext
    }), e;
  }
  function bs(e, t, a, l, s, u) {
    var p = 0;
    if (l = e, typeof l == "function") nf(l) && (p = 1);
    else if (typeof l == "string") p = N2(e, a, We.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
    else e: switch (l) {
      case ne:
        return e = Wt(31, a, t, s), e.elementType = ne, e.lanes = u, e;
      case ie:
        return Yo(a.children, s, u, t);
      case ae:
        p = 8, s |= 24;
        break;
      case q:
        return e = Wt(12, a, t, s | 2), e.elementType = q, e.lanes = u, e;
      case k:
        return e = Wt(13, a, t, s), e.elementType = k, e.lanes = u, e;
      case I:
        return e = Wt(19, a, t, s), e.elementType = I, e.lanes = u, e;
      case ce:
      case N:
        return e = s | 32, e = Wt(30, a, t, e), e.elementType = N, e.lanes = u, e.stateNode = {
          autoName: null,
          paired: null,
          clones: null,
          ref: null
        }, e;
      default:
        if (typeof l == "object" && l !== null) switch (l.$$typeof) {
          case B:
            p = 10;
            break e;
          case me:
            p = 9;
            break e;
          case G:
            p = 11;
            break e;
          case ee:
            p = 14;
            break e;
          case te:
            p = 16, l = null;
            break e;
        }
        p = 29, a = Error(c(130, e === null ? "null" : typeof e, "")), l = null;
    }
    return t = Wt(p, a, t, s), t.elementType = e, t.type = l, t.lanes = u, t;
  }
  function Yo(e, t, a, l) {
    return e = Wt(7, e, l, t), e.lanes = a, e;
  }
  function af(e, t, a) {
    return e = Wt(6, e, null, t), e.lanes = a, e;
  }
  function s0(e) {
    var t = Wt(18, null, null, 0);
    return t.stateNode = e, t;
  }
  function of(e, t, a) {
    return t = Wt(4, e.children !== null ? e.children : [], e.key, t), t.lanes = a, t.stateNode = {
      containerInfo: e.containerInfo,
      pendingChildren: null,
      implementation: e.implementation
    }, t;
  }
  var c0 = /* @__PURE__ */ new WeakMap();
  function Rn(e, t) {
    if (typeof e == "object" && e !== null) {
      var a = c0.get(e);
      return a !== void 0 ? a : (t = {
        value: e,
        source: t,
        stack: Ki(t)
      }, c0.set(e, t), t);
    }
    return {
      value: e,
      source: t,
      stack: Ki(t)
    };
  }
  var jl = [], Dl = 0, Ss = null, Vr = 0, An = [], Nn = 0, to = null, Wn = 1, ea = "";
  function Ea(e, t) {
    jl[Dl++] = Vr, jl[Dl++] = Ss, Ss = e, Vr = t;
  }
  function u0(e, t, a) {
    An[Nn++] = Wn, An[Nn++] = ea, An[Nn++] = to, to = e;
    var l = Wn;
    e = ea;
    var s = 32 - fn(l) - 1;
    l &= ~(1 << s), a += 1;
    var u = 32 - fn(t) + s;
    if (30 < u) {
      var p = s - s % 5;
      u = (l & (1 << p) - 1).toString(32), l >>= p, s -= p, Wn = 1 << 32 - fn(t) + s | a << s | l, ea = u + e;
    } else Wn = 1 << u | a << s | l, ea = e;
  }
  function xs(e) {
    e.return !== null && (Ea(e, 1), u0(e, 1, 0));
  }
  function lf(e) {
    for (; e === Ss; ) Ss = jl[--Dl], jl[Dl] = null, Vr = jl[--Dl], jl[Dl] = null;
    for (; e === to; ) to = An[--Nn], An[Nn] = null, ea = An[--Nn], An[Nn] = null, Wn = An[--Nn], An[Nn] = null;
  }
  function f0(e, t) {
    An[Nn++] = Wn, An[Nn++] = ea, An[Nn++] = to, Wn = t.id, ea = t.overflow, to = e;
  }
  var At = null, nt = null, De = !1, no = null, On = !1, rf = Error(c(519));
  function ao(e) {
    throw Yr(Rn(Error(c(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), rf;
  }
  function d0(e) {
    var t = e.stateNode, a = e.type, l = e.memoizedProps;
    switch (t[zt] = e, t[Jt] = l, a) {
      case "dialog":
        Be("cancel", t), Be("close", t);
        break;
      case "iframe":
      case "object":
      case "embed":
        Be("load", t);
        break;
      case "video":
      case "audio":
        for (a = 0; a < ui.length; a++) Be(ui[a], t);
        break;
      case "source":
        Be("error", t);
        break;
      case "img":
      case "image":
      case "link":
        Be("error", t), Be("load", t);
        break;
      case "details":
        Be("toggle", t);
        break;
      case "input":
        Be("invalid", t), Ev(t, l.value, l.defaultValue, l.checked, l.defaultChecked, l.type, l.name, !0);
        break;
      case "select":
        Be("invalid", t);
        break;
      case "textarea":
        Be("invalid", t), _v(t, l.value, l.defaultValue, l.children);
    }
    a = l.children, typeof a != "string" && typeof a != "number" && typeof a != "bigint" || t.textContent === "" + a || l.suppressHydrationWarning === !0 || Mg(t.textContent, a) ? (l.popover != null && (Be("beforetoggle", t), Be("toggle", t)), l.onScroll != null && Be("scroll", t), l.onScrollEnd != null && Be("scrollend", t), l.onClick != null && (t.onclick = Jn), t = !0) : t = !1, t || ao(e, !0);
  }
  function ws(e) {
    for (At = e.return; At; ) switch (At.tag) {
      case 5:
      case 31:
      case 13:
        On = !1;
        return;
      case 27:
      case 3:
        On = !0;
        return;
      default:
        At = At.return;
    }
  }
  function Ll(e) {
    if (e !== At) return !1;
    if (!De) return ws(e), De = !0, !1;
    var t = e.tag, a;
    if ((a = t !== 3 && t !== 27) && ((a = t === 5) && (a = e.type, a = !(a !== "form" && a !== "button") || Bd(e.type, e.memoizedProps)), a = !a), a && nt && ao(e), ws(e), t === 13) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(317));
      nt = Fg(e);
    } else if (t === 31) {
      if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(317));
      nt = Fg(e);
    } else t === 27 ? (t = nt, yo(e.type) ? (e = Pd, Pd = null, nt = e) : nt = t) : nt = At ? jn(e.stateNode.nextSibling) : null;
    return !0;
  }
  function qo() {
    nt = At = null, De = !1;
  }
  function sf() {
    var e = no;
    return e !== null && (nn === null ? nn = e : nn.push.apply(nn, e), no = null), e;
  }
  function Yr(e) {
    no === null ? no = [e] : no.push(e);
  }
  var cf = _e(null), Go = null, Ta = null;
  function oo(e, t, a) {
    Oe(cf, t._currentValue), t._currentValue = a;
  }
  function _a(e) {
    e._currentValue = cf.current, Ae(cf);
  }
  function Cs(e, t, a) {
    for (; e !== null; ) {
      var l = e.alternate;
      if ((e.childLanes & t) !== t ? (e.childLanes |= t, l !== null && (l.childLanes |= t)) : l !== null && (l.childLanes & t) !== t && (l.childLanes |= t), e === a) break;
      e = e.return;
    }
  }
  function uf(e, t, a, l) {
    var s = e.child;
    for (s !== null && (s.return = e); s !== null; ) {
      var u = s.dependencies;
      if (u !== null) {
        var p = s.child;
        u = u.firstContext;
        e: for (; u !== null; ) {
          var T = u;
          u = s;
          for (var z = 0; z < t.length; z++) if (T.context === t[z]) {
            u.lanes |= a, T = u.alternate, T !== null && (T.lanes |= a), Cs(u.return, a, e), l || (p = null);
            break e;
          }
          u = T.next;
        }
      } else if (s.tag === 18) {
        if (p = s.return, p === null) throw Error(c(341));
        p.lanes |= a, u = p.alternate, u !== null && (u.lanes |= a), Cs(p, a, e), p = null;
      } else s.tag === 13 && s.memoizedState !== null && s.memoizedState.dehydrated === null ? (s.lanes |= a, p = s.alternate, p !== null && (p.lanes |= a), Cs(s.return, a, e), p = s.child, p = p !== null ? p.sibling : null) : p = s.child;
      if (p !== null) p.return = s;
      else for (p = s; p !== null; ) {
        if (p === e) {
          p = null;
          break;
        }
        if (s = p.sibling, s !== null) {
          s.return = p.return, p = s;
          break;
        }
        p = p.return;
      }
      s = p;
    }
  }
  function Po(e, t, a, l) {
    e = null;
    for (var s = t, u = !1; s !== null; ) {
      if (!u) {
        if ((s.flags & 524288) !== 0) u = !0;
        else if ((s.flags & 262144) !== 0) break;
      }
      if (s.tag === 10) {
        var p = s.alternate;
        if (p === null) throw Error(c(387));
        if (p = p.memoizedProps, p !== null) {
          var T = s.type;
          mn(s.pendingProps.value, p.value) || (e !== null ? e.push(T) : e = [T]);
        }
      } else if (s === xt.current) {
        if (p = s.alternate, p === null) throw Error(c(387));
        p.memoizedState.memoizedState !== s.memoizedState.memoizedState && (e !== null ? e.push(rr) : e = [rr]);
      }
      s = s.return;
    }
    return e !== null && uf(t, e, a, l), t.flags |= 262144, e !== null;
  }
  function Es(e) {
    for (e = e.firstContext; e !== null; ) {
      if (!mn(e.context._currentValue, e.memoizedValue)) return !0;
      e = e.next;
    }
    return !1;
  }
  function Xo(e) {
    Go = e, Ta = null, e = e.dependencies, e !== null && (e.firstContext = null);
  }
  function jt(e) {
    return m0(Go, e);
  }
  function Ts(e, t) {
    return Go === null && Xo(e), m0(e, t);
  }
  function m0(e, t) {
    var a = t._currentValue;
    if (t = {
      context: t,
      memoizedValue: a,
      next: null
    }, Ta === null) {
      if (e === null) throw Error(c(308));
      Ta = t, e.dependencies = {
        lanes: 0,
        firstContext: t
      }, e.flags |= 524288;
    } else Ta = Ta.next = t;
    return a;
  }
  var tC = typeof AbortController < "u" ? AbortController : function() {
    var e = [], t = this.signal = {
      aborted: !1,
      addEventListener: function(a, l) {
        e.push(l);
      }
    };
    this.abort = function() {
      t.aborted = !0, e.forEach(function(a) {
        return a();
      });
    };
  }, nC = o.unstable_scheduleCallback, aC = o.unstable_NormalPriority, vt = {
    $$typeof: B,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function ff() {
    return {
      controller: new tC(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function qr(e) {
    e.refCount--, e.refCount === 0 && nC(aC, function() {
      e.controller.abort();
    });
  }
  function h0(e, t) {
    if ((e.pendingLanes & 4194048) !== 0) {
      var a = e.transitionTypes;
      for (a === null && (a = e.transitionTypes = []), e = 0; e < t.length; e++) {
        var l = t[e];
        a.indexOf(l) === -1 && a.push(l);
      }
    }
  }
  var Gr = null;
  function oC(e) {
    var t = e.transitionTypes;
    return e.transitionTypes = null, t;
  }
  var Pr = null, df = 0, Io = 0, Bl = null;
  function lC(e, t) {
    if (Pr === null) {
      var a = Pr = [];
      df = 0, Io = Ad(), Bl = {
        status: "pending",
        value: void 0,
        then: function(l) {
          a.push(l);
        }
      };
    }
    return df++, t.then(v0, v0), t;
  }
  function v0() {
    if (--df === 0 && (Gr = null, Pr !== null)) {
      Bl !== null && (Bl.status = "fulfilled");
      var e = Pr;
      Pr = null, Io = 0, Bl = null;
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
  }
  function rC(e, t) {
    var a = [], l = {
      status: "pending",
      value: null,
      reason: null,
      then: function(s) {
        a.push(s);
      }
    };
    return e.then(function() {
      l.status = "fulfilled", l.value = t;
      for (var s = 0; s < a.length; s++) (0, a[s])(t);
    }, function(s) {
      for (l.status = "rejected", l.reason = s, s = 0; s < a.length; s++) (0, a[s])(void 0);
    }), l;
  }
  var p0 = ve.S;
  ve.S = function(e, t) {
    if (lg = Yt(), typeof t == "object" && t !== null && typeof t.then == "function" && lC(e, t), Gr !== null) for (var a = er; a !== null; ) h0(a, Gr), a = a.next;
    if (a = e.types, a !== null) {
      for (var l = er; l !== null; ) h0(l, a), l = l.next;
      if (Io !== 0) {
        l = Gr, l === null && (l = Gr = []);
        for (var s = 0; s < a.length; s++) {
          var u = a[s];
          l.indexOf(u) === -1 && l.push(u);
        }
      }
    }
    p0 !== null && p0(e, t);
  };
  var Qo = _e(null);
  function mf() {
    var e = Qo.current;
    return e !== null ? e : et.pooledCache;
  }
  function _s(e, t) {
    t === null ? Oe(Qo, Qo.current) : Oe(Qo, t.pool);
  }
  function g0() {
    var e = mf();
    return e === null ? null : {
      parent: vt._currentValue,
      pool: e
    };
  }
  var Hl = Error(c(460)), hf = Error(c(474)), Rs = Error(c(542)), As = { then: function() {
  } };
  function y0(e) {
    return e = e.status, e === "fulfilled" || e === "rejected";
  }
  function b0(e, t, a) {
    switch (a = e[a], a === void 0 ? e.push(t) : a !== t && (t.then(Jn, Jn), t = a), t.status) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw e = t.reason, x0(e), e === void 0 && !("reason" in t) ? Error(c(600)) : e;
      default:
        if (typeof t.status == "string") t.then(Jn, Jn);
        else {
          if (e = et, e !== null && 100 < e.shellSuspendCounter) throw Error(c(482));
          e = t, e.status = "pending", e.then(function(l) {
            if (t.status === "pending") {
              var s = t;
              s.status = "fulfilled", s.value = l;
            }
          }, function(l) {
            if (t.status === "pending") {
              var s = t;
              s.status = "rejected", s.reason = l;
            }
          });
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw e = t.reason, x0(e), e;
        }
        throw Ko = t, Hl;
    }
  }
  function Zo(e) {
    try {
      var t = e._init;
      return t(e._payload);
    } catch (a) {
      throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ko = a, Hl) : a;
    }
  }
  var Ko = null;
  function S0() {
    if (Ko === null) throw Error(c(459));
    var e = Ko;
    return Ko = null, e;
  }
  function x0(e) {
    if (e === Hl || e === Rs) throw Error(c(483));
  }
  var kl = null, Xr = 0;
  function Ns(e) {
    var t = Xr;
    return Xr += 1, kl === null && (kl = []), b0(kl, e, t);
  }
  function lo(e, t) {
    t = t.props.ref, e.ref = t !== void 0 ? t : null;
  }
  function Os(e, t) {
    throw t.$$typeof === X ? Error(c(525)) : (e = Object.prototype.toString.call(t), Error(c(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
  }
  function w0(e) {
    function t(V, L) {
      if (e) {
        var P = V.deletions;
        P === null ? (V.deletions = [L], V.flags |= 16) : P.push(L);
      }
    }
    function a(V, L) {
      if (!e) return null;
      for (; L !== null; ) t(V, L), L = L.sibling;
      return null;
    }
    function l(V) {
      for (var L = /* @__PURE__ */ new Map(); V !== null; ) V.key === null ? L.set(V.index, V) : L.set(V.key, V), V = V.sibling;
      return L;
    }
    function s(V, L) {
      return V = Ca(V, L), V.index = 0, V.sibling = null, V;
    }
    function u(V, L, P) {
      return V.index = P, e ? (P = V.alternate, P !== null ? (P = P.index, P < L ? (V.flags |= 2, L) : P) : (V.flags |= 134217730, L)) : (V.flags |= 1048576, L);
    }
    function p(V) {
      return e && V.alternate === null && (V.flags |= 134217730), V;
    }
    function T(V, L, P, oe) {
      return L === null || L.tag !== 6 ? (L = af(P, V.mode, oe), L.return = V, L) : (L = s(L, P), L.return = V, L);
    }
    function z(V, L, P, oe) {
      var we = P.type;
      return we === ie ? (V = F(V, L, P.props.children, oe, P.key), lo(V, P), V) : L !== null && (L.elementType === we || typeof we == "object" && we !== null && we.$$typeof === te && Zo(we) === L.type) ? (L = s(L, P.props), lo(L, P), L.return = V, L) : (L = bs(P.type, P.key, P.props, null, V.mode, oe), lo(L, P), L.return = V, L);
    }
    function Y(V, L, P, oe) {
      return L === null || L.tag !== 4 || L.stateNode.containerInfo !== P.containerInfo || L.stateNode.implementation !== P.implementation ? (L = of(P, V.mode, oe), L.return = V, L) : (L = s(L, P.children || []), L.return = V, L);
    }
    function F(V, L, P, oe, we) {
      return L === null || L.tag !== 7 ? (L = Yo(P, V.mode, oe, we), L.return = V, L) : (L = s(L, P), L.return = V, L);
    }
    function le(V, L, P) {
      if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint") return L = af("" + L, V.mode, P), L.return = V, L;
      if (typeof L == "object" && L !== null) {
        switch (L.$$typeof) {
          case J:
            return P = bs(L.type, L.key, L.props, null, V.mode, P), lo(P, L), P.return = V, P;
          case W:
            return L = of(L, V.mode, P), L.return = V, L;
          case te:
            return L = Zo(L), le(V, L, P);
        }
        if (ye(L) || re(L)) return L = Yo(L, V.mode, P, null), L.return = V, L;
        if (typeof L.then == "function") return le(V, Ns(L), P);
        if (L.$$typeof === B) return le(V, Ts(V, L), P);
        Os(V, L);
      }
      return null;
    }
    function U(V, L, P, oe) {
      var we = L !== null ? L.key : null;
      if (typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint") return we !== null ? null : T(V, L, "" + P, oe);
      if (typeof P == "object" && P !== null) {
        switch (P.$$typeof) {
          case J:
            return P.key === we ? z(V, L, P, oe) : null;
          case W:
            return P.key === we ? Y(V, L, P, oe) : null;
          case te:
            return P = Zo(P), U(V, L, P, oe);
        }
        if (ye(P) || re(P)) return we !== null ? null : F(V, L, P, oe, null);
        if (typeof P.then == "function") return U(V, L, Ns(P), oe);
        if (P.$$typeof === B) return U(V, L, Ts(V, P), oe);
        Os(V, P);
      }
      return null;
    }
    function K(V, L, P, oe, we) {
      if (typeof oe == "string" && oe !== "" || typeof oe == "number" || typeof oe == "bigint") return V = V.get(P) || null, T(L, V, "" + oe, we);
      if (typeof oe == "object" && oe !== null) {
        switch (oe.$$typeof) {
          case J:
            return V = V.get(oe.key === null ? P : oe.key) || null, z(L, V, oe, we);
          case W:
            return V = V.get(oe.key === null ? P : oe.key) || null, Y(L, V, oe, we);
          case te:
            return oe = Zo(oe), K(V, L, P, oe, we);
        }
        if (ye(oe) || re(oe)) return V = V.get(P) || null, F(L, V, oe, we, null);
        if (typeof oe.then == "function") return K(V, L, P, Ns(oe), we);
        if (oe.$$typeof === B) return K(V, L, P, Ts(L, oe), we);
        Os(L, oe);
      }
      return null;
    }
    function be(V, L, P, oe) {
      for (var we = null, ke = null, Te = L, Re = L = 0, yt = null; Te !== null && Re < P.length; Re++) {
        Te.index > Re ? (yt = Te, Te = null) : yt = Te.sibling;
        var Ue = U(V, Te, P[Re], oe);
        if (Ue === null) {
          Te === null && (Te = yt);
          break;
        }
        e && Te && Ue.alternate === null && t(V, Te), L = u(Ue, L, Re), ke === null ? we = Ue : ke.sibling = Ue, ke = Ue, Te = yt;
      }
      if (Re === P.length) return a(V, Te), De && Ea(V, Re), we;
      if (Te === null) {
        for (; Re < P.length; Re++) Te = le(V, P[Re], oe), Te !== null && (L = u(Te, L, Re), ke === null ? we = Te : ke.sibling = Te, ke = Te);
        return De && Ea(V, Re), we;
      }
      for (Te = l(Te); Re < P.length; Re++) yt = K(Te, V, Re, P[Re], oe), yt !== null && (e && (Ue = yt.alternate, Ue !== null && Te.delete(Ue.key === null ? Re : Ue.key)), L = u(yt, L, Re), ke === null ? we = yt : ke.sibling = yt, ke = yt);
      return e && Te.forEach(function(Co) {
        return t(V, Co);
      }), De && Ea(V, Re), we;
    }
    function Ce(V, L, P, oe) {
      if (P == null) throw Error(c(151));
      for (var we = null, ke = null, Te = L, Re = L = 0, yt = null, Ue = P.next(); Te !== null && !Ue.done; Re++, Ue = P.next()) {
        Te.index > Re ? (yt = Te, Te = null) : yt = Te.sibling;
        var Co = U(V, Te, Ue.value, oe);
        if (Co === null) {
          Te === null && (Te = yt);
          break;
        }
        e && Te && Co.alternate === null && t(V, Te), L = u(Co, L, Re), ke === null ? we = Co : ke.sibling = Co, ke = Co, Te = yt;
      }
      if (Ue.done) return a(V, Te), De && Ea(V, Re), we;
      if (Te === null) {
        for (; !Ue.done; Re++, Ue = P.next()) Ue = le(V, Ue.value, oe), Ue !== null && (L = u(Ue, L, Re), ke === null ? we = Ue : ke.sibling = Ue, ke = Ue);
        return De && Ea(V, Re), we;
      }
      for (Te = l(Te); !Ue.done; Re++, Ue = P.next()) Ue = K(Te, V, Re, Ue.value, oe), Ue !== null && (e && (yt = Ue.alternate, yt !== null && Te.delete(yt.key === null ? Re : yt.key)), L = u(Ue, L, Re), ke === null ? we = Ue : ke.sibling = Ue, ke = Ue);
      return e && Te.forEach(function(G2) {
        return t(V, G2);
      }), De && Ea(V, Re), we;
    }
    function je(V, L, P, oe) {
      if (typeof P == "object" && P !== null && P.type === ie && P.key === null && P.props.ref === void 0 && (P = P.props.children), typeof P == "object" && P !== null) {
        switch (P.$$typeof) {
          case J:
            e: {
              for (var we = P.key; L !== null; ) {
                if (L.key === we) {
                  if (we = P.type, we === ie) {
                    if (L.tag === 7) {
                      a(V, L.sibling), oe = s(L, P.props.children), lo(oe, P), oe.return = V, V = oe;
                      break e;
                    }
                  } else if (L.elementType === we || typeof we == "object" && we !== null && we.$$typeof === te && Zo(we) === L.type) {
                    a(V, L.sibling), oe = s(L, P.props), lo(oe, P), oe.return = V, V = oe;
                    break e;
                  }
                  a(V, L);
                  break;
                } else t(V, L);
                L = L.sibling;
              }
              P.type === ie ? (oe = Yo(P.props.children, V.mode, oe, P.key), lo(oe, P), oe.return = V, V = oe) : (oe = bs(P.type, P.key, P.props, null, V.mode, oe), lo(oe, P), oe.return = V, V = oe);
            }
            return p(V);
          case W:
            e: {
              for (we = P.key; L !== null; ) {
                if (L.key === we) if (L.tag === 4 && L.stateNode.containerInfo === P.containerInfo && L.stateNode.implementation === P.implementation) {
                  a(V, L.sibling), oe = s(L, P.children || []), oe.return = V, V = oe;
                  break e;
                } else {
                  a(V, L);
                  break;
                }
                else t(V, L);
                L = L.sibling;
              }
              oe = of(P, V.mode, oe), oe.return = V, V = oe;
            }
            return p(V);
          case te:
            return P = Zo(P), je(V, L, P, oe);
        }
        if (ye(P)) return be(V, L, P, oe);
        if (re(P)) {
          if (we = re(P), typeof we != "function") throw Error(c(150));
          return P = we.call(P), Ce(V, L, P, oe);
        }
        if (typeof P.then == "function") return je(V, L, Ns(P), oe);
        if (P.$$typeof === B) return je(V, L, Ts(V, P), oe);
        Os(V, P);
      }
      return typeof P == "string" && P !== "" || typeof P == "number" || typeof P == "bigint" ? (P = "" + P, L !== null && L.tag === 6 ? (a(V, L.sibling), oe = s(L, P), oe.return = V, V = oe) : (a(V, L), oe = af(P, V.mode, oe), oe.return = V, V = oe), p(V)) : a(V, L);
    }
    return function(V, L, P, oe) {
      try {
        Xr = 0;
        var we = je(V, L, P, oe);
        return kl = null, we;
      } catch (Te) {
        if (Te === Hl || Te === Rs) throw Te;
        var ke = Wt(29, Te, null, V.mode);
        return ke.lanes = oe, ke.return = V, ke;
      }
    };
  }
  var Fo = w0(!0), C0 = w0(!1), ro = !1;
  function vf(e) {
    e.updateQueue = {
      baseState: e.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: {
        pending: null,
        lanes: 0,
        hiddenCallbacks: null
      },
      callbacks: null
    };
  }
  function pf(e, t) {
    e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
      baseState: e.baseState,
      firstBaseUpdate: e.firstBaseUpdate,
      lastBaseUpdate: e.lastBaseUpdate,
      shared: e.shared,
      callbacks: null
    });
  }
  function Jo(e) {
    return {
      lane: e,
      tag: 0,
      payload: null,
      callback: null,
      next: null
    };
  }
  function Wo(e, t, a) {
    var l = e.updateQueue;
    if (l === null) return null;
    if (l = l.shared, (Ge & 2) !== 0) {
      var s = l.pending;
      return s === null ? t.next = t : (t.next = s.next, s.next = t), l.pending = t, t = ys(e), r0(e, null, a), t;
    }
    return gs(e, l, t, a), ys(e);
  }
  function Ir(e, t, a) {
    if (t = t.updateQueue, t !== null && (t = t.shared, (a & 4194048) !== 0)) {
      var l = t.lanes;
      l &= e.pendingLanes, a |= l, t.lanes = a, cv(e, a);
    }
  }
  function gf(e, t) {
    var a = e.updateQueue, l = e.alternate;
    if (l !== null && (l = l.updateQueue, a === l)) {
      var s = null, u = null;
      if (a = a.firstBaseUpdate, a !== null) {
        do {
          var p = {
            lane: a.lane,
            tag: a.tag,
            payload: a.payload,
            callback: null,
            next: null
          };
          u === null ? s = u = p : u = u.next = p, a = a.next;
        } while (a !== null);
        u === null ? s = u = t : u = u.next = t;
      } else s = u = t;
      a = {
        baseState: l.baseState,
        firstBaseUpdate: s,
        lastBaseUpdate: u,
        shared: l.shared,
        callbacks: l.callbacks
      }, e.updateQueue = a;
      return;
    }
    e = a.lastBaseUpdate, e === null ? a.firstBaseUpdate = t : e.next = t, a.lastBaseUpdate = t;
  }
  var yf = !1;
  function Qr() {
    if (yf) {
      var e = Bl;
      if (e !== null) throw e;
    }
  }
  function Zr(e, t, a, l) {
    yf = !1;
    var s = e.updateQueue;
    ro = !1;
    var u = s.firstBaseUpdate, p = s.lastBaseUpdate, T = s.shared.pending;
    if (T !== null) {
      s.shared.pending = null;
      var z = T, Y = z.next;
      z.next = null, p === null ? u = Y : p.next = Y, p = z;
      var F = e.alternate;
      F !== null && (F = F.updateQueue, T = F.lastBaseUpdate, T !== p && (T === null ? F.firstBaseUpdate = Y : T.next = Y, F.lastBaseUpdate = z));
    }
    if (u !== null) {
      var le = s.baseState;
      p = 0, F = Y = z = null, T = u;
      do {
        var U = T.lane & -536870913, K = U !== T.lane;
        if (K ? (He & U) === U : (l & U) === U) {
          U !== 0 && U === Io && (yf = !0), F !== null && (F = F.next = {
            lane: 0,
            tag: T.tag,
            payload: T.payload,
            callback: null,
            next: null
          });
          e: {
            var be = e, Ce = T;
            U = t;
            var je = a;
            switch (Ce.tag) {
              case 1:
                if (be = Ce.payload, typeof be == "function") {
                  le = be.call(je, le, U);
                  break e;
                }
                le = be;
                break e;
              case 3:
                be.flags = be.flags & -65537 | 128;
              case 0:
                if (be = Ce.payload, U = typeof be == "function" ? be.call(je, le, U) : be, U == null) break e;
                le = H({}, le, U);
                break e;
              case 2:
                ro = !0;
            }
          }
          U = T.callback, U !== null && (e.flags |= 64, K && (e.flags |= 8192), K = s.callbacks, K === null ? s.callbacks = [U] : K.push(U));
        } else K = {
          lane: U,
          tag: T.tag,
          payload: T.payload,
          callback: T.callback,
          next: null
        }, F === null ? (Y = F = K, z = le) : F = F.next = K, p |= U;
        if (T = T.next, T === null) {
          if (T = s.shared.pending, T === null) break;
          K = T, T = K.next, K.next = null, s.lastBaseUpdate = K, s.shared.pending = null;
        }
      } while (!0);
      F === null && (z = le), s.baseState = z, s.firstBaseUpdate = Y, s.lastBaseUpdate = F, u === null && (s.shared.lanes = 0), ho |= p, e.lanes = p, e.memoizedState = le;
    }
  }
  function E0(e, t) {
    if (typeof e != "function") throw Error(c(191, e));
    e.call(t);
  }
  function T0(e, t) {
    var a = e.callbacks;
    if (a !== null) for (e.callbacks = null, e = 0; e < a.length; e++) E0(a[e], t);
  }
  var io = _e(null), Ms = _e(0);
  function _0(e, t) {
    e = Ma, Oe(Ms, e), Oe(io, t), Ma = e | t.baseLanes;
  }
  function bf() {
    Oe(Ms, Ma), Oe(io, io.current);
  }
  function Sf() {
    Ma = Ms.current, Ae(io), Ae(Ms);
  }
  var Dt = _e(null), $t = null;
  function so(e) {
    var t = e.alternate;
    Oe(Lt, Lt.current & 1), Oe(Dt, e), $t === null && (t === null || io.current !== null || t.memoizedState !== null) && ($t = e);
  }
  function xf(e) {
    Oe(Lt, Lt.current), Oe(Dt, e), $t === null && ($t = e);
  }
  function R0(e) {
    e.tag === 22 ? (Oe(Lt, Lt.current), Oe(Dt, e), $t === null && ($t = e)) : co();
  }
  function co() {
    Oe(Lt, Lt.current), Oe(Dt, Dt.current);
  }
  function hn(e) {
    Ae(Dt), $t === e && ($t = null), Ae(Lt);
  }
  var Lt = _e(0);
  function Kr(e, t) {
    Oe(Dt, Dt.current), Oe(Lt, t);
  }
  function wf(e) {
    Ae(Lt), Ae(Dt), $t === e && ($t = null);
  }
  function zs(e) {
    for (var t = e; t !== null; ) {
      if (t.tag === 13) {
        var a = t.memoizedState;
        if (a !== null && (a = a.dehydrated, a === null || qd(a) || Gd(a))) return t;
      } else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
        if ((t.flags & 128) !== 0) return t;
      } else if (t.child !== null) {
        t.child.return = t, t = t.child;
        continue;
      }
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return null;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
    return null;
  }
  var Ra = 0, ze = null, Je = null, pt = null, js = !1, Ul = !1, el = !1, Ds = 0, Fr = 0, $l = null, iC = 0;
  function dt() {
    throw Error(c(321));
  }
  function Cf(e, t) {
    if (t === null) return !1;
    for (var a = 0; a < t.length && a < e.length; a++) if (!mn(e[a], t[a])) return !1;
    return !0;
  }
  function Ef(e, t, a, l, s, u) {
    return Ra = u, ze = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, ve.H = e === null || e.memoizedState === null ? up : fp, el = !1, u = a(l, s), el = !1, Ul && (u = N0(t, a, l, s)), A0(e), u;
  }
  function A0(e) {
    ve.H = Vs;
    var t = Je !== null && Je.next !== null;
    if (Ra = 0, pt = Je = ze = null, js = !1, Fr = 0, $l = null, t) throw Error(c(300));
    e === null || gt || (e = e.dependencies, e !== null && Es(e) && (gt = !0));
  }
  function N0(e, t, a, l) {
    ze = e;
    var s = 0;
    do {
      if (Ul && ($l = null), Fr = 0, Ul = !1, 25 <= s) throw Error(c(301));
      if (s += 1, pt = Je = null, e.updateQueue != null) {
        var u = e.updateQueue;
        u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
      }
      ve.H = vC, u = t(a, l);
    } while (Ul);
    return u;
  }
  function sC() {
    var e = ve.H, t = e.useState()[0];
    return t = typeof t.then == "function" ? Jr(t) : t, e = e.useState()[0], (Je !== null ? Je.memoizedState : null) !== e && (ze.flags |= 1024), t;
  }
  function Tf() {
    var e = Ds !== 0;
    return Ds = 0, e;
  }
  function _f(e, t, a) {
    t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~a;
  }
  function Rf(e) {
    if (js) {
      for (e = e.memoizedState; e !== null; ) {
        var t = e.queue;
        t !== null && (t.pending = null), e = e.next;
      }
      js = !1;
    }
    Ra = 0, pt = Je = ze = null, Ul = !1, Fr = Ds = 0, $l = null;
  }
  function Gt() {
    var e = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return pt === null ? ze.memoizedState = pt = e : pt = pt.next = e, pt;
  }
  function ht() {
    if (Je === null) {
      var e = ze.alternate;
      e = e !== null ? e.memoizedState : null;
    } else e = Je.next;
    var t = pt === null ? ze.memoizedState : pt.next;
    if (t !== null) pt = t, Je = e;
    else {
      if (e === null)
        throw ze.alternate === null ? Error(c(467)) : Error(c(310));
      Je = e, e = {
        memoizedState: Je.memoizedState,
        baseState: Je.baseState,
        baseQueue: Je.baseQueue,
        queue: Je.queue,
        next: null
      }, pt === null ? ze.memoizedState = pt = e : pt = pt.next = e;
    }
    return pt;
  }
  function Ls() {
    return {
      lastEffect: null,
      events: null,
      stores: null,
      memoCache: null
    };
  }
  function Jr(e) {
    var t = Fr;
    return Fr += 1, $l === null && ($l = []), e = b0($l, e, t), t = ze, (pt === null ? t.memoizedState : pt.next) === null && (t = t.alternate, ve.H = t === null || t.memoizedState === null ? up : fp), e;
  }
  function Bs(e) {
    if (e !== null && typeof e == "object") {
      if (typeof e.then == "function") return Jr(e);
      if (e.$$typeof === Z) return;
      if (e.$$typeof === B) return jt(e);
    }
    throw Error(c(438, String(e)));
  }
  function Af(e) {
    var t = null, a = ze.updateQueue;
    if (a !== null && (t = a.memoCache), t == null) {
      var l = ze.alternate;
      l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (t = {
        data: l.data.map(function(s) {
          return s.slice();
        }),
        index: 0
      })));
    }
    if (t ??= {
      data: [],
      index: 0
    }, a === null && (a = Ls(), ze.updateQueue = a), a.memoCache = t, a = t.data[t.index], a === void 0) for (a = t.data[t.index] = Array(e), l = 0; l < e; l++) a[l] = fe;
    return t.index++, a;
  }
  function Aa(e, t) {
    return typeof t == "function" ? t(e) : t;
  }
  function Hs(e) {
    return Nf(ht(), Je, e);
  }
  function Nf(e, t, a) {
    var l = e.queue;
    if (l === null) throw Error(c(311));
    l.lastRenderedReducer = a;
    var s = e.baseQueue, u = l.pending;
    if (u !== null) {
      if (s !== null) {
        var p = s.next;
        s.next = u.next, u.next = p;
      }
      t.baseQueue = s = u, l.pending = null;
    }
    if (u = e.baseState, s === null) e.memoizedState = u;
    else {
      t = s.next;
      var T = p = null, z = null, Y = t, F = !1;
      do {
        var le = Y.lane & -536870913;
        if (le !== Y.lane ? (He & le) === le : (Ra & le) === le) {
          var U = Y.revertLane;
          if (U === 0) z !== null && (z = z.next = {
            lane: 0,
            revertLane: 0,
            gesture: null,
            action: Y.action,
            hasEagerState: Y.hasEagerState,
            eagerState: Y.eagerState,
            next: null
          }), le === Io && (F = !0);
          else if ((Ra & U) === U) {
            Y = Y.next, U === Io && (F = !0);
            continue;
          } else le = {
            lane: 0,
            revertLane: Y.revertLane,
            gesture: null,
            action: Y.action,
            hasEagerState: Y.hasEagerState,
            eagerState: Y.eagerState,
            next: null
          }, z === null ? (T = z = le, p = u) : z = z.next = le, ze.lanes |= U, ho |= U;
          le = Y.action, el && a(u, le), u = Y.hasEagerState ? Y.eagerState : a(u, le);
        } else U = {
          lane: le,
          revertLane: Y.revertLane,
          gesture: Y.gesture,
          action: Y.action,
          hasEagerState: Y.hasEagerState,
          eagerState: Y.eagerState,
          next: null
        }, z === null ? (T = z = U, p = u) : z = z.next = U, ze.lanes |= le, ho |= le;
        Y = Y.next;
      } while (Y !== null && Y !== t);
      if (z === null ? p = u : z.next = T, !mn(u, e.memoizedState) && (gt = !0, F && (a = Bl, a !== null))) throw a;
      e.memoizedState = u, e.baseState = p, e.baseQueue = z, l.lastRenderedState = u;
    }
    return s === null && (l.lanes = 0), [e.memoizedState, l.dispatch];
  }
  function Of(e) {
    var t = ht(), a = t.queue;
    if (a === null) throw Error(c(311));
    a.lastRenderedReducer = e;
    var l = a.dispatch, s = a.pending, u = t.memoizedState;
    if (s !== null) {
      a.pending = null;
      var p = s = s.next;
      do
        u = e(u, p.action), p = p.next;
      while (p !== s);
      mn(u, t.memoizedState) || (gt = !0), t.memoizedState = u, t.baseQueue === null && (t.baseState = u), a.lastRenderedState = u;
    }
    return [u, l];
  }
  function O0(e, t, a) {
    var l = ze, s = ht(), u = De;
    if (u) {
      if (a === void 0) throw Error(c(407));
      a = a();
    } else a = t();
    var p = !mn((Je || s).memoizedState, a);
    if (p && (s.memoizedState = a, gt = !0), s = s.queue, jf(j0.bind(null, l, s, e), [e]), e = s.getSnapshot !== t || p || pt !== null && (pt.memoizedState.tag & 1) !== 0, Vl(e ? 9 : 8, { destroy: void 0 }, z0.bind(null, l, s, a, t), null), e) {
      if (l.flags |= 2048, et === null) throw Error(c(349));
      u || (Ra & 127) !== 0 || M0(l, t, a);
    }
    return a;
  }
  function M0(e, t, a) {
    e.flags |= 16384, e = {
      getSnapshot: t,
      value: a
    }, t = ze.updateQueue, t === null ? (t = Ls(), ze.updateQueue = t, t.stores = [e]) : (a = t.stores, a === null ? t.stores = [e] : a.push(e));
  }
  function z0(e, t, a, l) {
    t.value = a, t.getSnapshot = l, D0(t) && L0(e);
  }
  function j0(e, t, a) {
    return a(function() {
      D0(t) && L0(e);
    });
  }
  function D0(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
      var a = t();
      return !mn(e, a);
    } catch {
      return !0;
    }
  }
  function L0(e) {
    var t = Vo(e, 2);
    t !== null && an(t, e, 2);
  }
  function Mf(e) {
    var t = Gt();
    if (typeof e == "function") {
      var a = e;
      if (e = a(), el) {
        Ja(!0);
        try {
          a();
        } finally {
          Ja(!1);
        }
      }
    }
    return t.memoizedState = t.baseState = e, t.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Aa,
      lastRenderedState: e
    }, t;
  }
  function B0(e, t, a, l) {
    return e.baseState = a, Nf(e, Je, typeof l == "function" ? l : Aa);
  }
  function cC(e, t, a, l, s) {
    if ($s(e)) throw Error(c(485));
    if (e = t.action, e !== null) {
      var u = {
        payload: s,
        action: e,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(p) {
          u.listeners.push(p);
        }
      };
      ve.T !== null ? a(!0) : u.isTransition = !1, l(u), a = t.pending, a === null ? (u.next = t.pending = u, H0(t, u)) : (u.next = a.next, t.pending = a.next = u);
    }
  }
  function H0(e, t) {
    var a = t.action, l = t.payload, s = e.state;
    if (t.isTransition) {
      var u = ve.T, p = {};
      p.types = u !== null ? u.types : null, ve.T = p;
      try {
        var T = a(s, l), z = ve.S;
        z !== null && z(p, T), k0(e, t, T);
      } catch (Y) {
        zf(e, t, Y);
      } finally {
        u !== null && p.types !== null && (u.types = p.types), ve.T = u;
      }
    } else try {
      u = a(s, l), k0(e, t, u);
    } catch (Y) {
      zf(e, t, Y);
    }
  }
  function k0(e, t, a) {
    a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(function(l) {
      U0(e, t, l);
    }, function(l) {
      return zf(e, t, l);
    }) : U0(e, t, a);
  }
  function U0(e, t, a) {
    t.status = "fulfilled", t.value = a, $0(t), e.state = a, t = e.pending, t !== null && (a = t.next, a === t ? e.pending = null : (a = a.next, t.next = a, H0(e, a)));
  }
  function zf(e, t, a) {
    var l = e.pending;
    if (e.pending = null, l !== null) {
      l = l.next;
      do
        t.status = "rejected", t.reason = a, $0(t), t = t.next;
      while (t !== l);
    }
    e.action = null;
  }
  function $0(e) {
    e = e.listeners;
    for (var t = 0; t < e.length; t++) (0, e[t])();
  }
  function V0(e, t) {
    return t;
  }
  function Y0(e, t) {
    if (De) {
      var a = et.formState;
      if (a !== null) {
        e: {
          var l = ze;
          if (De) {
            if (nt) {
              t: {
                for (var s = nt, u = On; s.nodeType !== 8; ) {
                  if (!u) {
                    s = null;
                    break t;
                  }
                  if (s = jn(s.nextSibling), s === null) {
                    s = null;
                    break t;
                  }
                }
                u = s.data, s = u === "F!" || u === "F" ? s : null;
              }
              if (s) {
                nt = jn(s.nextSibling), l = s.data === "F!";
                break e;
              }
            }
            ao(l);
          }
          l = !1;
        }
        l && (t = a[0]);
      }
    }
    return a = Gt(), a.memoizedState = a.baseState = t, l = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: V0,
      lastRenderedState: t
    }, a.queue = l, a = ip.bind(null, ze, l), l.dispatch = a, l = Mf(!1), u = kf.bind(null, ze, !1, l.queue), l = Gt(), s = {
      state: t,
      dispatch: null,
      action: e,
      pending: null
    }, l.queue = s, a = cC.bind(null, ze, s, u, a), s.dispatch = a, l.memoizedState = e, [
      t,
      a,
      !1
    ];
  }
  function q0(e) {
    return G0(ht(), Je, e);
  }
  function G0(e, t, a) {
    if (t = Nf(e, t, V0)[0], e = Hs(Aa)[0], typeof t == "object" && t !== null && typeof t.then == "function") try {
      var l = Jr(t);
    } catch (p) {
      throw p === Hl ? Rs : p;
    }
    else l = t;
    t = ht();
    var s = t.queue, u = s.dispatch;
    return a !== t.memoizedState && (ze.flags |= 2048, Vl(9, { destroy: void 0 }, uC.bind(null, s, a), null)), [
      l,
      u,
      e
    ];
  }
  function uC(e, t) {
    e.action = t;
  }
  function P0(e) {
    var t = ht(), a = Je;
    if (a !== null) return G0(t, a, e);
    ht(), t = t.memoizedState, a = ht();
    var l = a.queue.dispatch;
    return a.memoizedState = e, [
      t,
      l,
      !1
    ];
  }
  function Vl(e, t, a, l) {
    return e = {
      tag: e,
      create: a,
      deps: l,
      inst: t,
      next: null
    }, t = ze.updateQueue, t === null && (t = Ls(), ze.updateQueue = t), a = t.lastEffect, a === null ? t.lastEffect = e.next = e : (l = a.next, a.next = e, e.next = l, t.lastEffect = e), e;
  }
  function X0() {
    return ht().memoizedState;
  }
  function ks(e, t, a, l) {
    var s = Gt();
    ze.flags |= e, s.memoizedState = Vl(1 | t, { destroy: void 0 }, a, l === void 0 ? null : l);
  }
  function Us(e, t, a, l) {
    var s = ht();
    l = l === void 0 ? null : l;
    var u = s.memoizedState.inst;
    Je !== null && l !== null && Cf(l, Je.memoizedState.deps) ? s.memoizedState = Vl(t, u, a, l) : (ze.flags |= e, s.memoizedState = Vl(1 | t, u, a, l));
  }
  function I0(e, t) {
    ks(8390656, 8, e, t);
  }
  function jf(e, t) {
    Us(2048, 8, e, t);
  }
  function fC(e) {
    ze.flags |= 4;
    var t = ze.updateQueue;
    if (t === null) t = Ls(), ze.updateQueue = t, t.events = [e];
    else {
      var a = t.events;
      a === null ? t.events = [e] : a.push(e);
    }
  }
  function Q0(e) {
    var t = ht().memoizedState;
    return fC({
      ref: t,
      nextImpl: e
    }), function() {
      if ((Ge & 2) !== 0) throw Error(c(440));
      return t.impl.apply(void 0, arguments);
    };
  }
  function Z0(e, t) {
    return Us(4, 2, e, t);
  }
  function K0(e, t) {
    return Us(4, 4, e, t);
  }
  function F0(e, t) {
    if (typeof t == "function") {
      e = e();
      var a = t(e);
      return function() {
        typeof a == "function" ? a() : t(null);
      };
    }
    if (t != null) return e = e(), t.current = e, function() {
      t.current = null;
    };
  }
  function J0(e, t, a) {
    a = a != null ? a.concat([e]) : null, Us(4, 4, F0.bind(null, t, e), a);
  }
  function Df() {
  }
  function W0(e, t) {
    var a = ht();
    t = t === void 0 ? null : t;
    var l = a.memoizedState;
    return t !== null && Cf(t, l[1]) ? l[0] : (a.memoizedState = [e, t], e);
  }
  function ep(e, t) {
    var a = ht();
    t = t === void 0 ? null : t;
    var l = a.memoizedState;
    if (t !== null && Cf(t, l[1])) return l[0];
    if (l = e(), el) {
      Ja(!0);
      try {
        e();
      } finally {
        Ja(!1);
      }
    }
    return a.memoizedState = [l, t], l;
  }
  function Lf(e, t, a) {
    return a === void 0 || (Ra & 1073741824) !== 0 && (He & 261930) === 0 ? e.memoizedState = t : (e.memoizedState = a, e = ig(), ze.lanes |= e, ho |= e, a);
  }
  function tp(e, t, a, l) {
    return mn(a, t) ? a : io.current !== null ? (e = Lf(e, a, l), mn(e, t) || (gt = !0), e) : (Ra & 106) === 0 || (Ra & 1073741824) !== 0 && (He & 261930) === 0 ? (gt = !0, e.memoizedState = a) : (e = ig(), ze.lanes |= e, ho |= e, t);
  }
  function np(e, t, a, l, s) {
    var u = de.p;
    de.p = u !== 0 && 8 > u ? u : 8;
    var p = ve.T, T = {};
    T.types = p !== null ? p.types : null, ve.T = T, kf(e, !1, t, a);
    try {
      var z = s(), Y = ve.S;
      Y !== null && Y(T, z), z !== null && typeof z == "object" && typeof z.then == "function" ? Wr(e, t, rC(z, l), zn(e)) : Wr(e, t, l, zn(e));
    } catch (F) {
      Wr(e, t, {
        then: function() {
        },
        status: "rejected",
        reason: F
      }, zn());
    } finally {
      de.p = u, p !== null && T.types !== null && (p.types = T.types), ve.T = p;
    }
  }
  function dC() {
  }
  function Bf(e, t, a, l) {
    if (e.tag !== 5) throw Error(c(476));
    var s = ap(e).queue;
    np(e, s, t, Ne, a === null ? dC : function() {
      return op(e), a(l);
    });
  }
  function ap(e) {
    var t = e.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: Ne,
      baseState: Ne,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Aa,
        lastRenderedState: Ne
      },
      next: null
    };
    var a = {};
    return t.next = {
      memoizedState: a,
      baseState: a,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Aa,
        lastRenderedState: a
      },
      next: null
    }, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
  }
  function op(e) {
    var t = ap(e);
    t.next === null && (t = e.alternate.memoizedState), Wr(e, t.next.queue, {}, zn());
  }
  function Hf() {
    return jt(rr);
  }
  function lp() {
    return ht().memoizedState;
  }
  function rp() {
    return ht().memoizedState;
  }
  function mC(e) {
    for (var t = e.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var a = zn();
          e = Jo(a);
          var l = Wo(t, e, a);
          l !== null && (an(l, t, a), Ir(l, t, a)), t = { cache: ff() }, e.payload = t;
          return;
      }
      t = t.return;
    }
  }
  function hC(e, t, a) {
    var l = zn();
    a = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, $s(e) ? sp(t, a) : (a = tf(e, t, a, l), a !== null && (an(a, e, l), cp(a, t, l)));
  }
  function ip(e, t, a) {
    Wr(e, t, a, zn());
  }
  function Wr(e, t, a, l) {
    var s = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if ($s(e)) sp(t, s);
    else {
      var u = e.alternate;
      if (e.lanes === 0 && (u === null || u.lanes === 0) && (u = t.lastRenderedReducer, u !== null)) try {
        var p = t.lastRenderedState, T = u(p, a);
        if (s.hasEagerState = !0, s.eagerState = T, mn(T, p)) return gs(e, t, s, 0), et === null && ps(), !1;
      } catch {
      }
      if (a = tf(e, t, s, l), a !== null) return an(a, e, l), cp(a, t, l), !0;
    }
    return !1;
  }
  function kf(e, t, a, l) {
    if (l = {
      lane: 2,
      revertLane: Ad(),
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, $s(e)) {
      if (t) throw Error(c(479));
    } else t = tf(e, a, l, 2), t !== null && an(t, e, 2);
  }
  function $s(e) {
    var t = e.alternate;
    return e === ze || t !== null && t === ze;
  }
  function sp(e, t) {
    Ul = js = !0;
    var a = e.pending;
    a === null ? t.next = t : (t.next = a.next, a.next = t), e.pending = t;
  }
  function cp(e, t, a) {
    if ((a & 4194048) !== 0) {
      var l = t.lanes;
      l &= e.pendingLanes, a |= l, t.lanes = a, cv(e, a);
    }
  }
  var Vs = {
    readContext: jt,
    use: Bs,
    useCallback: dt,
    useContext: dt,
    useEffect: dt,
    useImperativeHandle: dt,
    useLayoutEffect: dt,
    useInsertionEffect: dt,
    useMemo: dt,
    useReducer: dt,
    useRef: dt,
    useState: dt,
    useDebugValue: dt,
    useDeferredValue: dt,
    useTransition: dt,
    useSyncExternalStore: dt,
    useId: dt,
    useHostTransitionStatus: dt,
    useFormState: dt,
    useActionState: dt,
    useOptimistic: dt,
    useMemoCache: dt,
    useCacheRefresh: dt,
    useEffectEvent: dt
  }, up = {
    readContext: jt,
    use: Bs,
    useCallback: function(e, t) {
      return Gt().memoizedState = [e, t === void 0 ? null : t], e;
    },
    useContext: jt,
    useEffect: I0,
    useImperativeHandle: function(e, t, a) {
      a = a != null ? a.concat([e]) : null, ks(4194308, 4, F0.bind(null, t, e), a);
    },
    useLayoutEffect: function(e, t) {
      return ks(4194308, 4, e, t);
    },
    useInsertionEffect: function(e, t) {
      ks(4, 2, e, t);
    },
    useMemo: function(e, t) {
      var a = Gt();
      t = t === void 0 ? null : t;
      var l = e();
      if (el) {
        Ja(!0);
        try {
          e();
        } finally {
          Ja(!1);
        }
      }
      return a.memoizedState = [l, t], l;
    },
    useReducer: function(e, t, a) {
      var l = Gt();
      if (a !== void 0) {
        var s = a(t);
        if (el) {
          Ja(!0);
          try {
            a(t);
          } finally {
            Ja(!1);
          }
        }
      } else s = t;
      return l.memoizedState = l.baseState = s, e = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: e,
        lastRenderedState: s
      }, l.queue = e, e = e.dispatch = hC.bind(null, ze, e), [l.memoizedState, e];
    },
    useRef: function(e) {
      var t = Gt();
      return e = { current: e }, t.memoizedState = e;
    },
    useState: function(e) {
      e = Mf(e);
      var t = e.queue, a = ip.bind(null, ze, t);
      return t.dispatch = a, [e.memoizedState, a];
    },
    useDebugValue: Df,
    useDeferredValue: function(e, t) {
      return Lf(Gt(), e, t);
    },
    useTransition: function() {
      var e = Mf(!1);
      return e = np.bind(null, ze, e.queue, !0, !1), Gt().memoizedState = e, [!1, e];
    },
    useSyncExternalStore: function(e, t, a) {
      var l = ze, s = Gt();
      if (De) {
        if (a === void 0) throw Error(c(407));
        a = a();
      } else {
        if (a = t(), et === null) throw Error(c(349));
        (He & 127) !== 0 || M0(l, t, a);
      }
      s.memoizedState = a;
      var u = {
        value: a,
        getSnapshot: t
      };
      return s.queue = u, I0(j0.bind(null, l, u, e), [e]), l.flags |= 2048, Vl(9, { destroy: void 0 }, z0.bind(null, l, u, a, t), null), a;
    },
    useId: function() {
      var e = Gt(), t = et.identifierPrefix;
      if (De) {
        var a = ea, l = Wn;
        a = (l & ~(1 << 32 - fn(l) - 1)).toString(32) + a, t = "_" + t + "R_" + a, a = Ds++, 0 < a && (t += "H" + a.toString(32)), t += "_";
      } else a = iC++, t = "_" + t + "r_" + a.toString(32) + "_";
      return e.memoizedState = t;
    },
    useHostTransitionStatus: Hf,
    useFormState: Y0,
    useActionState: Y0,
    useOptimistic: function(e) {
      var t = Gt();
      t.memoizedState = t.baseState = e;
      var a = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return t.queue = a, t = kf.bind(null, ze, !0, a), a.dispatch = t, [e, t];
    },
    useMemoCache: Af,
    useCacheRefresh: function() {
      return Gt().memoizedState = mC.bind(null, ze);
    },
    useEffectEvent: function(e) {
      var t = Gt(), a = { impl: e };
      return t.memoizedState = a, function() {
        if ((Ge & 2) !== 0) throw Error(c(440));
        return a.impl.apply(void 0, arguments);
      };
    }
  }, fp = {
    readContext: jt,
    use: Bs,
    useCallback: W0,
    useContext: jt,
    useEffect: jf,
    useImperativeHandle: J0,
    useInsertionEffect: Z0,
    useLayoutEffect: K0,
    useMemo: ep,
    useReducer: Hs,
    useRef: X0,
    useState: function() {
      return Hs(Aa);
    },
    useDebugValue: Df,
    useDeferredValue: function(e, t) {
      return tp(ht(), Je.memoizedState, e, t);
    },
    useTransition: function() {
      var e = Hs(Aa)[0], t = ht().memoizedState;
      return [typeof e == "boolean" ? e : Jr(e), t];
    },
    useSyncExternalStore: O0,
    useId: lp,
    useHostTransitionStatus: Hf,
    useFormState: q0,
    useActionState: q0,
    useOptimistic: function(e, t) {
      return B0(ht(), Je, e, t);
    },
    useMemoCache: Af,
    useCacheRefresh: rp,
    useEffectEvent: Q0
  }, vC = {
    readContext: jt,
    use: Bs,
    useCallback: W0,
    useContext: jt,
    useEffect: jf,
    useImperativeHandle: J0,
    useInsertionEffect: Z0,
    useLayoutEffect: K0,
    useMemo: ep,
    useReducer: Of,
    useRef: X0,
    useState: function() {
      return Of(Aa);
    },
    useDebugValue: Df,
    useDeferredValue: function(e, t) {
      var a = ht();
      return Je === null ? Lf(a, e, t) : tp(a, Je.memoizedState, e, t);
    },
    useTransition: function() {
      var e = Of(Aa)[0], t = ht().memoizedState;
      return [typeof e == "boolean" ? e : Jr(e), t];
    },
    useSyncExternalStore: O0,
    useId: lp,
    useHostTransitionStatus: Hf,
    useFormState: P0,
    useActionState: P0,
    useOptimistic: function(e, t) {
      var a = ht();
      return Je !== null ? B0(a, Je, e, t) : (a.baseState = e, [e, a.queue.dispatch]);
    },
    useMemoCache: Af,
    useCacheRefresh: rp,
    useEffectEvent: Q0
  };
  function Uf(e, t, a, l) {
    t = e.memoizedState, a = a(l, t), a = a == null ? t : H({}, t, a), e.memoizedState = a, e.lanes === 0 && (e.updateQueue.baseState = a);
  }
  var $f = {
    enqueueSetState: function(e, t, a) {
      e = e._reactInternals;
      var l = zn(), s = Jo(l);
      s.payload = t, a != null && (s.callback = a), t = Wo(e, s, l), t !== null && (an(t, e, l), Ir(t, e, l));
    },
    enqueueReplaceState: function(e, t, a) {
      e = e._reactInternals;
      var l = zn(), s = Jo(l);
      s.tag = 1, s.payload = t, a != null && (s.callback = a), t = Wo(e, s, l), t !== null && (an(t, e, l), Ir(t, e, l));
    },
    enqueueForceUpdate: function(e, t) {
      e = e._reactInternals;
      var a = zn(), l = Jo(a);
      l.tag = 2, t != null && (l.callback = t), t = Wo(e, l, a), t !== null && (an(t, e, a), Ir(t, e, a));
    }
  };
  function dp(e, t, a, l, s, u, p) {
    return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(l, u, p) : t.prototype && t.prototype.isPureReactComponent ? !Ur(a, l) || !Ur(s, u) : !0;
  }
  function mp(e, t, a, l) {
    e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(a, l), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(a, l), t.state !== e && $f.enqueueReplaceState(t, t.state, null);
  }
  function tl(e, t) {
    var a = t;
    if ("ref" in t) {
      a = {};
      for (var l in t) l !== "ref" && (a[l] = t[l]);
    }
    if (e = e.defaultProps) {
      a === t && (a = H({}, a));
      for (var s in e) a[s] === void 0 && (a[s] = e[s]);
    }
    return a;
  }
  function pC(e) {
    vs(e);
  }
  function gC(e) {
    console.error(e);
  }
  function yC(e) {
    vs(e);
  }
  function Ys(e, t) {
    try {
      var a = e.onUncaughtError;
      a(t.value, { componentStack: t.stack });
    } catch (l) {
      setTimeout(function() {
        throw l;
      });
    }
  }
  function hp(e, t, a) {
    try {
      var l = e.onCaughtError;
      l(a.value, {
        componentStack: a.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null
      });
    } catch (s) {
      setTimeout(function() {
        throw s;
      });
    }
  }
  function Vf(e, t, a) {
    return a = Jo(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
      Ys(e, t);
    }, a;
  }
  function vp(e) {
    return e = Jo(e), e.tag = 3, e;
  }
  function pp(e, t, a, l) {
    var s = a.type.getDerivedStateFromError;
    if (typeof s == "function") {
      var u = l.value;
      e.payload = function() {
        return s(u);
      }, e.callback = function() {
        hp(t, a, l);
      };
    }
    var p = a.stateNode;
    p !== null && typeof p.componentDidCatch == "function" && (e.callback = function() {
      hp(t, a, l), typeof s != "function" && (vo === null ? vo = /* @__PURE__ */ new Set([this]) : vo.add(this));
      var T = l.stack;
      this.componentDidCatch(l.value, { componentStack: T !== null ? T : "" });
    });
  }
  function bC(e, t, a, l, s) {
    if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
      if (t = a.alternate, t !== null && Po(t, a, s, !0), a = Dt.current, a !== null) {
        switch (a.tag) {
          case 31:
          case 13:
          case 19:
            return $t === null ? cc() : a.alternate === null && mt === 0 && (mt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = s, l === As ? a.flags |= 16384 : (t = a.updateQueue, t === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : t.add(l), Td(e, l, s)), !1;
          case 22:
            return a.flags |= 65536, l === As ? a.flags |= 16384 : (t = a.updateQueue, t === null ? (t = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([l])
            }, a.updateQueue = t) : (a = t.retryQueue, a === null ? t.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Td(e, l, s)), !1;
        }
        throw Error(c(435, a.tag));
      }
      return Td(e, l, s), cc(), !1;
    }
    if (De) return t = Dt.current, t !== null ? ((t.flags & 65536) === 0 && (t.flags |= 256), t.flags |= 65536, t.lanes = s, l !== rf && (e = Error(c(422), { cause: l }), Yr(Rn(e, a)))) : (l !== rf && (t = Error(c(423), { cause: l }), Yr(Rn(t, a))), e = e.current.alternate, e.flags |= 65536, s &= -s, e.lanes |= s, l = Rn(l, a), s = Vf(e.stateNode, l, s), gf(e, s), mt !== 4 && (mt = 2)), !1;
    var u = Error(c(520), { cause: l });
    if (u = Rn(u, a), ii === null ? ii = [u] : ii.push(u), mt !== 4 && (mt = 2), t === null) return !0;
    l = Rn(l, a), a = t;
    do {
      switch (a.tag) {
        case 3:
          return a.flags |= 65536, e = s & -s, a.lanes |= e, e = Vf(a.stateNode, l, e), gf(a, e), !1;
        case 1:
          if (t = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof t.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (vo === null || !vo.has(u)))) return a.flags |= 65536, s &= -s, a.lanes |= s, s = vp(s), pp(s, e, a, l), gf(a, s), !1;
          break;
        case 22:
          if (a.memoizedState !== null) return a.flags |= 65536, !1;
      }
      a = a.return;
    } while (a !== null);
    return !1;
  }
  var Yf = Error(c(461)), gt = !1;
  function Ct(e, t, a, l) {
    t.child = e === null ? C0(t, null, a, l) : Fo(t, e.child, a, l);
  }
  function gp(e, t, a, l, s) {
    a = a.render;
    var u = t.ref;
    if ("ref" in l) {
      var p = {};
      for (var T in l) T !== "ref" && (p[T] = l[T]);
    } else p = l;
    return Xo(t), l = Ef(e, t, a, p, u, s), T = Tf(), e !== null && !gt ? (_f(e, t, s), Na(e, t, s)) : (De && T && xs(t), t.flags |= 1, Ct(e, t, l, s), t.child);
  }
  function yp(e, t, a, l, s) {
    if (e === null) {
      var u = a.type;
      return typeof u == "function" && !nf(u) && u.defaultProps === void 0 && a.compare === null ? (t.tag = 15, t.type = u, bp(e, t, u, l, s)) : (e = bs(a.type, null, l, t, t.mode, s), e.ref = t.ref, e.return = t, t.child = e);
    }
    if (u = e.child, !Kf(e, s)) {
      var p = u.memoizedProps;
      if (a = a.compare, a = a !== null ? a : Ur, a(p, l) && e.ref === t.ref) return Na(e, t, s);
    }
    return t.flags |= 1, e = Ca(u, l), e.ref = t.ref, e.return = t, t.child = e;
  }
  function bp(e, t, a, l, s) {
    if (e !== null) {
      var u = e.memoizedProps;
      if (Ur(u, l) && e.ref === t.ref) if (gt = !1, t.pendingProps = l = u, Kf(e, s)) (e.flags & 131072) !== 0 && (gt = !0);
      else return t.lanes = e.lanes, Na(e, t, s);
    }
    return qf(e, t, a, l, s);
  }
  function Sp(e, t, a, l) {
    var s = l.children, u = e !== null ? e.memoizedState : null;
    if (e === null && t.stateNode === null && (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), l.mode === "hidden") {
      if ((t.flags & 128) !== 0) {
        if (u = u !== null ? u.baseLanes | a : a, e !== null) {
          for (l = t.child = e.child, s = 0; l !== null; ) s = s | l.lanes | l.childLanes, l = l.sibling;
          l = s & ~u;
        } else l = 0, t.child = null;
        return xp(e, t, u, a, l);
      }
      if ((a & 536870912) !== 0) t.memoizedState = {
        baseLanes: 0,
        cachePool: null
      }, e !== null && _s(t, u !== null ? u.cachePool : null), u !== null ? _0(t, u) : bf(), R0(t);
      else return l = t.lanes = 536870912, xp(e, t, u !== null ? u.baseLanes | a : a, a, l);
    } else u !== null ? (_s(t, u.cachePool), _0(t, u), co(), t.memoizedState = null) : (e !== null && _s(t, null), bf(), co());
    return Ct(e, t, s, a), t.child;
  }
  function ei(e, t) {
    return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), t.sibling;
  }
  function xp(e, t, a, l, s) {
    var u = mf();
    return u = u === null ? null : {
      parent: vt._currentValue,
      pool: u
    }, t.memoizedState = {
      baseLanes: a,
      cachePool: u
    }, e !== null && _s(t, null), bf(), R0(t), e !== null && Po(e, t, l, !0), t.childLanes = s, null;
  }
  function qs(e, t) {
    return t = Gs({
      mode: t.mode,
      children: t.children
    }, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function wp(e, t, a) {
    return Fo(t, e.child, null, a), e = qs(t, t.pendingProps), e.flags |= 2, hn(t), t.memoizedState = null, e;
  }
  function SC(e, t, a) {
    var l = t.pendingProps, s = (t.flags & 128) !== 0;
    if (t.flags &= -129, e === null) {
      if (De) {
        if (l.mode === "hidden") return e = qs(t, l), t.lanes = 536870912, e.memoizedState = {
          baseLanes: 0,
          cachePool: null
        }, ei(null, e);
        if (xf(t), (e = nt) ? (e = Kg(e, On), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: to !== null ? {
            id: Wn,
            overflow: ea
          } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, a = s0(e), a.return = t, t.child = a, At = t, nt = null)) : e = null, e === null) throw ao(t);
        return t.lanes = 536870912, null;
      }
      return qs(t, l);
    }
    var u = e.memoizedState;
    if (u !== null) {
      var p = u.dehydrated;
      if (xf(t), s) if (t.flags & 256) t.flags &= -257, t = wp(e, t, a);
      else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
      else throw Error(c(558));
      else if (gt || Po(e, t, a, !1), s = (a & e.childLanes) !== 0, gt || s) {
        if (io.current === null) {
          if (l = et, l !== null && (p = uv(l, a), p !== 0 && p !== u.retryLane)) throw u.retryLane = p, Vo(e, p), an(l, e, p), Yf;
          cc();
        }
        t = wp(e, t, a);
      } else e = u.treeContext, nt = jn(p.nextSibling), At = t, De = !0, no = null, On = !1, e !== null && f0(t, e), t = qs(t, l), t.flags |= 134221824;
      return t;
    }
    return e = Ca(e.child, {
      mode: l.mode,
      children: l.children
    }), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function Yl(e, t) {
    var a = t.ref;
    if (a === null) e !== null && e.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof a != "function" && typeof a != "object") throw Error(c(284));
      (e === null || e.ref !== a) && (t.flags |= 4194816);
    }
  }
  function qf(e, t, a, l, s) {
    return Xo(t), a = Ef(e, t, a, l, void 0, s), l = Tf(), e !== null && !gt ? (_f(e, t, s), Na(e, t, s)) : (De && l && xs(t), t.flags |= 1, Ct(e, t, a, s), t.child);
  }
  function Cp(e, t, a, l, s, u) {
    return Xo(t), t.updateQueue = null, a = N0(t, l, a, s), A0(e), l = Tf(), e !== null && !gt ? (_f(e, t, u), Na(e, t, u)) : (De && l && xs(t), t.flags |= 1, Ct(e, t, a, u), t.child);
  }
  function Ep(e, t, a, l, s) {
    if (Xo(t), t.stateNode === null) {
      var u = zl, p = a.contextType;
      typeof p == "object" && p !== null && (u = jt(p)), u = new a(l, u), t.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = $f, t.stateNode = u, u._reactInternals = t, u = t.stateNode, u.props = l, u.state = t.memoizedState, u.refs = {}, vf(t), p = a.contextType, u.context = typeof p == "object" && p !== null ? jt(p) : zl, u.state = t.memoizedState, p = a.getDerivedStateFromProps, typeof p == "function" && (Uf(t, a, p, l), u.state = t.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (p = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), p !== u.state && $f.enqueueReplaceState(u, u.state, null), Zr(t, l, u, s), Qr(), u.state = t.memoizedState), typeof u.componentDidMount == "function" && (t.flags |= 4194308), l = !0;
    } else if (e === null) {
      u = t.stateNode;
      var T = t.memoizedProps, z = tl(a, T);
      u.props = z;
      var Y = u.context, F = a.contextType;
      p = zl, typeof F == "object" && F !== null && (p = jt(F));
      var le = a.getDerivedStateFromProps;
      F = typeof le == "function" || typeof u.getSnapshotBeforeUpdate == "function", T = t.pendingProps !== T, F || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (T || Y !== p) && mp(t, u, l, p), ro = !1;
      var U = t.memoizedState;
      u.state = U, Zr(t, l, u, s), Qr(), Y = t.memoizedState, T || U !== Y || ro ? (typeof le == "function" && (Uf(t, a, le, l), Y = t.memoizedState), (z = ro || dp(t, a, z, l, U, Y, p)) ? (F || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = l, t.memoizedState = Y), u.props = l, u.state = Y, u.context = p, l = z) : (typeof u.componentDidMount == "function" && (t.flags |= 4194308), l = !1);
    } else {
      u = t.stateNode, pf(e, t), p = t.memoizedProps, F = tl(a, p), u.props = F, le = t.pendingProps, U = u.context, Y = a.contextType, z = zl, typeof Y == "object" && Y !== null && (z = jt(Y)), T = a.getDerivedStateFromProps, (Y = typeof T == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (p !== le || U !== z) && mp(t, u, l, z), ro = !1, U = t.memoizedState, u.state = U, Zr(t, l, u, s), Qr();
      var K = t.memoizedState;
      p !== le || U !== K || ro || e !== null && e.dependencies !== null && Es(e.dependencies) ? (typeof T == "function" && (Uf(t, a, T, l), K = t.memoizedState), (F = ro || dp(t, a, F, l, U, K, z) || e !== null && e.dependencies !== null && Es(e.dependencies)) ? (Y || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, K, z), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(l, K, z)), typeof u.componentDidUpdate == "function" && (t.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || p === e.memoizedProps && U === e.memoizedState || (t.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || p === e.memoizedProps && U === e.memoizedState || (t.flags |= 1024), t.memoizedProps = l, t.memoizedState = K), u.props = l, u.state = K, u.context = z, l = F) : (typeof u.componentDidUpdate != "function" || p === e.memoizedProps && U === e.memoizedState || (t.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || p === e.memoizedProps && U === e.memoizedState || (t.flags |= 1024), l = !1);
    }
    return u = l, Yl(e, t), l = (t.flags & 128) !== 0, u || l ? (u = t.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : u.render(), t.flags |= 1, e !== null && l ? (t.child = Fo(t, e.child, null, s), t.child = Fo(t, null, a, s)) : Ct(e, t, a, s), t.memoizedState = u.state, e = t.child) : e = Na(e, t, s), e;
  }
  function Tp(e, t, a, l) {
    return qo(), t.flags |= 256, Ct(e, t, a, l), t.child;
  }
  var Gf = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function Pf(e) {
    return {
      baseLanes: e,
      cachePool: g0()
    };
  }
  function Xf(e, t, a) {
    return e = e !== null ? e.childLanes & ~a : 0, t && (e |= gn), e;
  }
  function _p(e, t, a) {
    var l = t.pendingProps, s = !1, u = (t.flags & 128) !== 0, p;
    if ((p = u) || (p = e !== null && e.memoizedState === null ? !1 : (Lt.current & 2) !== 0), p && (s = !0, t.flags &= -129), p = (t.flags & 32) !== 0, t.flags &= -33, e === null) {
      if (De) {
        if (s ? so(t) : co(), (e = nt) ? (e = Kg(e, On), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
          dehydrated: e,
          treeContext: to !== null ? {
            id: Wn,
            overflow: ea
          } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, a = s0(e), a.return = t, t.child = a, At = t, nt = null)) : e = null, e === null) throw ao(t);
        return Gd(e) ? t.lanes = 32 : t.lanes = 536870912, null;
      }
      return u = l.children, l = l.fallback, s ? (co(), s = t.mode, u = Gs({
        mode: "hidden",
        children: u
      }, s), l = Yo(l, s, a, null), u.return = t, l.return = t, u.sibling = l, t.child = u, l = t.child, l.memoizedState = Pf(a), l.childLanes = Xf(e, p, a), t.memoizedState = Gf, ei(null, l)) : (so(t), If(t, u));
    }
    var T = e.memoizedState;
    if (T !== null) {
      var z = T.dehydrated;
      if (z !== null) return xC(e, t, u, p, l, z, T, a);
    }
    return s ? (co(), s = l.fallback, u = t.mode, T = e.child, z = T.sibling, l = Ca(T, {
      mode: "hidden",
      children: l.children
    }), l.subtreeFlags = T.subtreeFlags & 1206910976, z !== null ? s = Ca(z, s) : (s = Yo(s, u, a, null), s.flags |= 2), s.return = t, l.return = t, l.sibling = s, t.child = l, ei(null, l), l = t.child, s = e.child.memoizedState, s === null ? s = Pf(a) : (u = s.cachePool, u !== null ? (T = vt._currentValue, u = u.parent !== T ? {
      parent: T,
      pool: T
    } : u) : u = g0(), s = {
      baseLanes: s.baseLanes | a,
      cachePool: u
    }), l.memoizedState = s, l.childLanes = Xf(e, p, a), t.memoizedState = Gf, ei(e.child, l)) : (so(t), a = e.child, e = a.sibling, a = Ca(a, {
      mode: "visible",
      children: l.children
    }), a.return = t, a.sibling = null, e !== null && (p = t.deletions, p === null ? (t.deletions = [e], t.flags |= 16) : p.push(e)), t.child = a, t.memoizedState = null, a);
  }
  function If(e, t) {
    return t = Gs({
      mode: "visible",
      children: t
    }, e.mode), t.return = e, e.child = t;
  }
  function Gs(e, t) {
    return e = Wt(22, e, null, t), e.lanes = 0, e;
  }
  function Ps(e, t, a) {
    return Fo(t, e.child, null, a), e = If(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
  }
  function xC(e, t, a, l, s, u, p, T) {
    if (a)
      return t.flags & 256 ? (so(t), t.flags &= -257, Ps(e, t, T)) : t.memoizedState !== null ? (co(), t.child = e.child, t.flags |= 128, null) : (co(), u = s.fallback, p = t.mode, s = Gs({
        mode: "visible",
        children: s.children
      }, p), u = Yo(u, p, T, null), u.flags |= 2, s.return = t, u.return = t, s.sibling = u, t.child = s, Fo(t, e.child, null, T), s = t.child, s.memoizedState = Pf(T), s.childLanes = Xf(e, l, T), t.memoizedState = Gf, ei(null, s));
    if (so(t), Gd(u)) {
      if (l = u.nextSibling && u.nextSibling.dataset, l) var z = l.dgst;
      return l = z, l !== "" && (s = Error(c(419)), s.stack = "", s.digest = l, Yr({
        value: s,
        source: null,
        stack: null
      })), Ps(e, t, T);
    }
    if (gt || Po(e, t, T, !1), l = (T & e.childLanes) !== 0, gt || l) {
      if (io.current !== null) return Ps(e, t, T);
      if (l = et, l !== null && (s = uv(l, T), s !== 0 && s !== p.retryLane)) throw p.retryLane = s, Vo(e, s), an(l, e, s), Yf;
      return qd(u) || cc(), Ps(e, t, T);
    }
    return qd(u) ? (t.flags |= 192, t.child = e.child, null) : (e = p.treeContext, nt = jn(u.nextSibling), At = t, De = !0, no = null, On = !1, e !== null && f0(t, e), t = If(t, s.children), t.flags |= 134221824, t);
  }
  function Rp(e, t, a) {
    e.lanes |= t;
    var l = e.alternate;
    l !== null && (l.lanes |= t), Cs(e.return, t, a);
  }
  function Ap(e) {
    for (var t = null; e !== null; ) {
      var a = e.alternate;
      a !== null && zs(a) === null && (t = e), e = e.sibling;
    }
    return t;
  }
  function Xs(e, t, a, l, s, u) {
    var p = e.memoizedState;
    p === null ? e.memoizedState = {
      isBackwards: t,
      rendering: null,
      renderingStartTime: 0,
      last: l,
      tail: a,
      tailMode: s,
      treeForkCount: u
    } : (p.isBackwards = t, p.rendering = null, p.renderingStartTime = 0, p.last = l, p.tail = a, p.tailMode = s, p.treeForkCount = u);
  }
  function Qf(e) {
    var t = e.child;
    for (e.child = null; t !== null; ) {
      var a = t.sibling;
      t.sibling = e.child, e.child = t, t = a;
    }
  }
  function Zf(e, t, a) {
    var l = t.pendingProps, s = l.revealOrder, u = l.tail;
    l = l.children;
    var p = Lt.current;
    if (t.flags & 128) return Kr(t, p), null;
    var T = (p & 2) !== 0;
    if (T ? (p = p & 1 | 2, t.flags |= 128) : p &= 1, Kr(t, p), s === "backwards" && e !== null ? (Qf(e), Ct(e, t, l, a), Qf(e)) : Ct(e, t, l, a), l = De ? Vr : 0, !T && e !== null && (e.flags & 128) !== 0) e: for (e = t.child; e !== null; ) {
      if (e.tag === 13) e.memoizedState !== null && Rp(e, a, t);
      else if (e.tag === 19) Rp(e, a, t);
      else if (e.child !== null) {
        e.child.return = e, e = e.child;
        continue;
      }
      if (e === t) break e;
      for (; e.sibling === null; ) {
        if (e.return === null || e.return === t) break e;
        e = e.return;
      }
      e.sibling.return = e.return, e = e.sibling;
    }
    switch (s) {
      case "backwards":
        a = Ap(t.child), a === null ? (s = t.child, t.child = null) : (s = a.sibling, a.sibling = null, Qf(t)), Xs(t, !0, s, null, u, l);
        break;
      case "unstable_legacy-backwards":
        for (a = null, s = t.child, t.child = null; s !== null; ) {
          if (e = s.alternate, e !== null && zs(e) === null) {
            t.child = s;
            break;
          }
          e = s.sibling, s.sibling = a, a = s, s = e;
        }
        Xs(t, !0, a, null, u, l);
        break;
      case "together":
        Xs(t, !1, null, null, void 0, l);
        break;
      case "independent":
        t.memoizedState = null;
        break;
      default:
        a = Ap(t.child), a === null ? (s = t.child, t.child = null) : (s = a.sibling, a.sibling = null), Xs(t, !1, s, a, u, l);
    }
    return t.child;
  }
  function Np(e, t, a) {
    var l = t.pendingProps;
    return oo(t, t.type, l.value), Ct(e, t, l.children, a), t.child;
  }
  function Na(e, t, a) {
    if (e !== null && (t.dependencies = e.dependencies), ho |= t.lanes, (a & t.childLanes) === 0) if (e !== null) {
      if (Po(e, t, a, !1), (a & t.childLanes) === 0) return null;
    } else return null;
    if (e !== null && t.child !== e.child) throw Error(c(153));
    if (t.child !== null) {
      for (e = t.child, a = Ca(e, e.pendingProps), t.child = a, a.return = t; e.sibling !== null; ) e = e.sibling, a = a.sibling = Ca(e, e.pendingProps), a.return = t;
      a.sibling = null;
    }
    return t.child;
  }
  function Kf(e, t) {
    return (e.lanes & t) !== 0 ? !0 : (e = e.dependencies, !!(e !== null && Es(e)));
  }
  function wC(e, t, a) {
    switch (t.tag) {
      case 3:
        Ye(t, t.stateNode.containerInfo), oo(t, vt, e.memoizedState.cache), qo();
        break;
      case 27:
      case 5:
        qe(t);
        break;
      case 4:
        Ye(t, t.stateNode.containerInfo);
        break;
      case 10:
        oo(t, t.type, t.memoizedProps.value);
        break;
      case 31:
        if (t.memoizedState !== null) return t.flags |= 128, xf(t), null;
        break;
      case 13:
        var l = t.memoizedState;
        if (l !== null) {
          if (l.dehydrated !== null) return so(t), t.flags |= 128, null;
          l = Po(e, t, a, !1);
          var s = t.child.childLanes;
          return l || (a & s) !== 0 ? _p(e, t, a) : (so(t), e = Na(e, t, a), e !== null ? e.sibling : null);
        }
        so(t);
        break;
      case 19:
        if (t.flags & 128) return Zf(e, t, a);
        if (s = (e.flags & 128) !== 0, l = (a & t.childLanes) !== 0, l || (Po(e, t, a, !1), l = (a & t.childLanes) !== 0), s) {
          if (l) return Zf(e, t, a);
          t.flags |= 128;
        }
        if (s = t.memoizedState, s !== null && (s.rendering = null, s.tail = null, s.lastEffect = null), Kr(t, Lt.current), l) break;
        return null;
      case 22:
        return t.lanes = 0, Sp(e, t, a, t.pendingProps);
      case 24:
        oo(t, vt, e.memoizedState.cache);
    }
    return Na(e, t, a);
  }
  function Op(e, t, a) {
    if (e !== null) if (e.memoizedProps !== t.pendingProps) gt = !0;
    else {
      if (!Kf(e, a) && (t.flags & 128) === 0) return gt = !1, wC(e, t, a);
      gt = (e.flags & 131072) !== 0;
    }
    else gt = !1, De && (t.flags & 1048576) !== 0 && u0(t, Vr, t.index);
    switch (t.lanes = 0, t.tag) {
      case 16:
        e: {
          var l = t.pendingProps;
          if (e = Zo(t.elementType), t.type = e, typeof e == "function") nf(e) ? (l = tl(e, l), t.tag = 1, t = Ep(null, t, e, l, a)) : (t.tag = 0, t = qf(null, t, e, l, a));
          else {
            if (e != null) {
              var s = e.$$typeof;
              if (s === G) {
                t.tag = 11, t = gp(null, t, e, l, a);
                break e;
              } else if (s === ee) {
                t.tag = 14, t = yp(null, t, e, l, a);
                break e;
              } else if (s === B) {
                t.tag = 10, t.type = e, t = Np(null, t, a);
                break e;
              }
            }
            throw t = he(e) || e, Error(c(306, t, ""));
          }
        }
        return t;
      case 0:
        return qf(e, t, t.type, t.pendingProps, a);
      case 1:
        return l = t.type, s = tl(l, t.pendingProps), Ep(e, t, l, s, a);
      case 3:
        e: {
          if (Ye(t, t.stateNode.containerInfo), e === null) throw Error(c(387));
          l = t.pendingProps;
          var u = t.memoizedState;
          s = u.element, pf(e, t), Zr(t, l, null, a);
          var p = t.memoizedState;
          if (l = p.cache, oo(t, vt, l), l !== u.cache && uf(t, [vt], a, !0), Qr(), l = p.element, u.isDehydrated) if (u = {
            element: l,
            isDehydrated: !1,
            cache: p.cache
          }, t.updateQueue.baseState = u, t.memoizedState = u, t.flags & 256) {
            t = Tp(e, t, l, a);
            break e;
          } else if (l !== s) {
            s = Rn(Error(c(424)), t), Yr(s), t = Tp(e, t, l, a);
            break e;
          } else
            for (e = t.stateNode.containerInfo, e.nodeType === 9 ? e = e.body : e = e.nodeName === "HTML" ? e.ownerDocument.body : e, nt = jn(e.firstChild), At = t, De = !0, no = null, On = !0, a = C0(t, null, l, a), t.child = a; a; ) a.flags = a.flags & -3 | 134221824, a = a.sibling;
          else {
            if (qo(), l === s) {
              t = Na(e, t, a);
              break e;
            }
            Ct(e, t, l, a);
          }
          t = t.child;
        }
        return t;
      case 26:
        return Yl(e, t), e === null ? (a = ay(t.type, null, t.pendingProps, null)) ? t.memoizedState = a : De || (t.stateNode = Lg(t.type, t.pendingProps, tt.current, t)) : t.memoizedState = ay(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
      case 27:
        return qe(t), e === null && De && (l = t.stateNode = Wg(t.type, t.pendingProps, tt.current), At = t, On = !0, s = nt, yo(t.type) ? (Pd = s, nt = jn(l.firstChild)) : nt = s), Ct(e, t, t.pendingProps.children, a), Yl(e, t), e === null && (t.flags |= 4194304), t.child;
      case 5:
        return e === null && De && ((s = l = nt) && (l = h2(l, t.type, t.pendingProps, On), l !== null ? (t.stateNode = l, At = t, nt = jn(l.firstChild), On = !1, s = !0) : s = !1), s || ao(t)), qe(t), s = t.type, u = t.pendingProps, p = e !== null ? e.memoizedProps : null, l = u.children, Bd(s, u) ? l = null : p !== null && Bd(s, p) && (t.flags |= 32), t.memoizedState !== null && (s = Ef(e, t, sC, null, null, a), rr._currentValue = s), Yl(e, t), Ct(e, t, l, a), t.child;
      case 6:
        return e === null && De && ((e = a = nt) && (a = v2(a, t.pendingProps, On), a !== null ? (t.stateNode = a, At = t, nt = null, e = !0) : e = !1), e || ao(t)), null;
      case 13:
        return _p(e, t, a);
      case 4:
        return Ye(t, t.stateNode.containerInfo), l = t.pendingProps, e === null ? t.child = Fo(t, null, l, a) : Ct(e, t, l, a), t.child;
      case 11:
        return gp(e, t, t.type, t.pendingProps, a);
      case 7:
        return l = t.pendingProps, Yl(e, t), Ct(e, t, l, a), t.child;
      case 8:
        return Ct(e, t, t.pendingProps.children, a), t.child;
      case 12:
        return Ct(e, t, t.pendingProps.children, a), t.child;
      case 10:
        return Np(e, t, a);
      case 9:
        return s = t.type._context, l = t.pendingProps.children, Xo(t), s = jt(s), l = l(s), t.flags |= 1, Ct(e, t, l, a), t.child;
      case 14:
        return yp(e, t, t.type, t.pendingProps, a);
      case 15:
        return bp(e, t, t.type, t.pendingProps, a);
      case 19:
        return Zf(e, t, a);
      case 31:
        return SC(e, t, a);
      case 22:
        return Sp(e, t, a, t.pendingProps);
      case 24:
        return Xo(t), l = jt(vt), e === null ? (s = mf(), s === null && (s = et, u = ff(), s.pooledCache = u, u.refCount++, u !== null && (s.pooledCacheLanes |= a), s = u), t.memoizedState = {
          parent: l,
          cache: s
        }, vf(t), oo(t, vt, s)) : ((e.lanes & a) !== 0 && (pf(e, t), Zr(t, null, null, a), Qr()), s = e.memoizedState, u = t.memoizedState, s.parent !== l ? (s = {
          parent: l,
          cache: l
        }, t.memoizedState = s, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = s), oo(t, vt, l)) : (l = u.cache, oo(t, vt, l), l !== s.cache && uf(t, [vt], a, !0))), Ct(e, t, t.pendingProps.children, a), t.child;
      case 30:
        return t.stateNode === null && (t.stateNode = {
          autoName: null,
          paired: null,
          clones: null,
          ref: null
        }), l = t.pendingProps, l.name != null && l.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : De && xs(t), e !== null && e.memoizedProps.name !== l.name ? t.flags |= 4194816 : Yl(e, t), Ct(e, t, l.children, a), t.child;
      case 29:
        throw t.pendingProps;
    }
    throw Error(c(156, t.tag));
  }
  function Oa(e) {
    e.flags |= 4;
  }
  function Ff(e, t, a, l, s) {
    var u;
    if ((u = (e.mode & 32) !== 0) && (u = a === null ? iy(t, l) : iy(t, l) && (l.src !== a.src || l.srcSet !== a.srcSet)), u) {
      if (e.flags |= 16777216, (s & 335544128) === s) if (e.stateNode.complete) e.flags |= 8192;
      else if (fg()) e.flags |= 8192;
      else throw Ko = As, hf;
    } else e.flags &= -16777217;
  }
  function Mp(e, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0) e.flags &= -16777217;
    else if (e.flags |= 16777216, !sy(t)) if (fg()) e.flags |= 8192;
    else throw Ko = As, hf;
  }
  function Is(e, t) {
    t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag !== 22 ? iv() : 536870912, e.lanes |= t, Il |= t);
  }
  function ti(e, t) {
    if (!De) switch (e.tailMode) {
      case "visible":
        break;
      case "collapsed":
        for (var a = e.tail, l = null; a !== null; ) a.alternate !== null && (l = a), a = a.sibling;
        l === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : l.sibling = null;
        break;
      default:
        for (t = e.tail, a = null; t !== null; ) t.alternate !== null && (a = t), t = t.sibling;
        a === null ? e.tail = null : a.sibling = null;
    }
  }
  function at(e) {
    var t = e.alternate !== null && e.alternate.child === e.child, a = 0, l = 0;
    if (t) for (var s = e.child; s !== null; ) a |= s.lanes | s.childLanes, l |= s.subtreeFlags & 1206910976, l |= s.flags & 1206910976, s.return = e, s = s.sibling;
    else for (s = e.child; s !== null; ) a |= s.lanes | s.childLanes, l |= s.subtreeFlags, l |= s.flags, s.return = e, s = s.sibling;
    return e.subtreeFlags |= l, e.childLanes = a, t;
  }
  function CC(e, t, a) {
    var l = t.pendingProps;
    switch (lf(t), t.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return at(t), null;
      case 1:
        return at(t), null;
      case 3:
        return a = t.stateNode, l = null, e !== null && (l = e.memoizedState.cache), t.memoizedState.cache !== l && (t.flags |= 2048), _a(vt), Vt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (e === null || e.child === null) && (Ll(t) ? Oa(t) : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, sf())), at(t), null;
      case 26:
        var s = t.type, u = t.memoizedState;
        return e === null ? (Oa(t), u !== null ? (at(t), Mp(t, u)) : (at(t), Ff(t, s, null, l, a))) : u ? u !== e.memoizedState ? (Oa(t), at(t), Mp(t, u)) : (at(t), t.flags &= -16777217) : (e = e.memoizedProps, e !== l && Oa(t), at(t), Ff(t, s, e, l, a)), null;
      case 27:
        if (ga(t), a = tt.current, s = t.type, e !== null && t.stateNode != null) e.memoizedProps !== l && Oa(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(c(166));
            return at(t), t.subtreeFlags &= -33554433, null;
          }
          e = We.current, Ll(t) ? d0(t, e) : (e = Wg(s, l, a), t.stateNode = e, Oa(t));
        }
        return at(t), t.subtreeFlags &= -33554433, null;
      case 5:
        if (ga(t), s = t.type, e !== null && t.stateNode != null) e.memoizedProps !== l && Oa(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(c(166));
            return at(t), t.subtreeFlags &= -33554433, null;
          }
          if (u = We.current, Ll(t)) d0(t, u);
          else {
            var p = di(tt.current);
            switch (u) {
              case 1:
                u = p.createElementNS("http://www.w3.org/2000/svg", s);
                break;
              case 2:
                u = p.createElementNS("http://www.w3.org/1998/Math/MathML", s);
                break;
              default:
                switch (s) {
                  case "svg":
                    u = p.createElementNS("http://www.w3.org/2000/svg", s);
                    break;
                  case "math":
                    u = p.createElementNS("http://www.w3.org/1998/Math/MathML", s);
                    break;
                  case "script":
                    u = p.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(u.firstChild);
                    break;
                  case "select":
                    u = typeof l.is == "string" ? p.createElement("select", { is: l.is }) : p.createElement("select"), l.multiple ? u.multiple = !0 : l.size && (u.size = l.size);
                    break;
                  default:
                    u = typeof l.is == "string" ? p.createElement(s, { is: l.is }) : p.createElement(s);
                }
            }
            u[zt] = t, u[Jt] = l;
            e: for (p = t.child; p !== null; ) {
              if (p.tag === 5 || p.tag === 6) u.appendChild(p.stateNode);
              else if (p.tag !== 4 && p.tag !== 27 && p.child !== null) {
                p.child.return = p, p = p.child;
                continue;
              }
              if (p === t) break e;
              for (; p.sibling === null; ) {
                if (p.return === null || p.return === t) break e;
                p = p.return;
              }
              p.sibling.return = p.return, p = p.sibling;
            }
            t.stateNode = u;
            e: switch (Ht(u, s, l), s) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break e;
              case "img":
                l = !0;
                break e;
              default:
                l = !1;
            }
            l && Oa(t);
          }
        }
        return at(t), t.subtreeFlags &= -33554433, Ff(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, a), null;
      case 6:
        if (e && t.stateNode != null) e.memoizedProps !== l && Oa(t);
        else {
          if (typeof l != "string" && t.stateNode === null) throw Error(c(166));
          if (e = tt.current, Ll(t)) {
            if (e = t.stateNode, a = t.memoizedProps, l = null, s = At, s !== null) switch (s.tag) {
              case 27:
              case 5:
                l = s.memoizedProps;
            }
            e[zt] = t, e = !!(e.nodeValue === a || l !== null && l.suppressHydrationWarning === !0 || Mg(e.nodeValue, a)), e || ao(t, !0);
          } else e = di(e).createTextNode(l), e[zt] = t, t.stateNode = e;
        }
        return at(t), null;
      case 31:
        if (a = t.memoizedState, e === null || e.memoizedState !== null) {
          if (l = Ll(t), a !== null) {
            if (e === null) {
              if (!l) throw Error(c(318));
              if (e = t.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(c(557));
              e[zt] = t;
            } else qo(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            at(t), e = !1;
          } else a = sf(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), e = !0;
          if (!e)
            return t.flags & 256 ? (hn(t), t) : (hn(t), null);
          if ((t.flags & 128) !== 0) throw Error(c(558));
        }
        return at(t), null;
      case 13:
        if (l = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
          if (s = Ll(t), l !== null && l.dehydrated !== null) {
            if (e === null) {
              if (!s) throw Error(c(318));
              if (s = t.memoizedState, s = s !== null ? s.dehydrated : null, !s) throw Error(c(317));
              s[zt] = t;
            } else qo(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
            at(t), s = !1;
          } else s = sf(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = s), s = !0;
          if (!s)
            return t.flags & 256 ? (hn(t), t) : (hn(t), null);
        }
        return hn(t), (t.flags & 128) !== 0 ? (t.lanes = a, t) : (a = l !== null, e = e !== null && e.memoizedState !== null, a && (l = t.child, s = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (s = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== s && (l.flags |= 2048)), a !== e && a && (t.child.flags |= 8192), Is(t, t.updateQueue), at(t), null);
      case 4:
        return Vt(), e === null && Rg(t.stateNode.containerInfo), t.flags |= 67108864, at(t), null;
      case 10:
        return _a(t.type), at(t), null;
      case 19:
        if (wf(t), l = t.memoizedState, l === null) return at(t), null;
        if (s = (t.flags & 128) !== 0, u = l.rendering, u === null) if (s) ti(l, !1);
        else {
          if (mt !== 0 || e !== null && (e.flags & 128) !== 0) for (e = t.child; e !== null; ) {
            if (u = zs(e), u !== null) {
              for (t.flags |= 128, ti(l, !1), e = u.updateQueue, t.updateQueue = e, Is(t, e), t.subtreeFlags = 0, e = a, a = t.child; a !== null; ) i0(a, e), a = a.sibling;
              return Kr(t, Lt.current & 1 | 2), De && Ea(t, l.treeForkCount), t.child;
            }
            e = e.sibling;
          }
          l.tail !== null && Yt() > lc && (t.flags |= 128, s = !0, ti(l, !1), t.lanes = 4194304);
        }
        else {
          if (!s) if (e = zs(u), e !== null) {
            if (t.flags |= 128, s = !0, e = e.updateQueue, t.updateQueue = e, Is(t, e), ti(l, !0), l.tail === null && l.tailMode !== "collapsed" && l.tailMode !== "visible" && !u.alternate && !De) return at(t), null;
          } else 2 * Yt() - l.renderingStartTime > lc && a !== 536870912 && (t.flags |= 128, s = !0, ti(l, !1), t.lanes = 4194304);
          l.isBackwards ? (u.sibling = t.child, t.child = u) : (e = l.last, e !== null ? e.sibling = u : t.child = u, l.last = u);
        }
        if (l.tail !== null) {
          e = l.tail;
          e: {
            for (a = e; a !== null; ) {
              if (a.alternate !== null) {
                a = !1;
                break e;
              }
              a = a.sibling;
            }
            a = !0;
          }
          return l.rendering = e, l.tail = e.sibling, l.renderingStartTime = Yt(), e.sibling = null, u = Lt.current, u = s ? u & 1 | 2 : u & 1, l.tailMode === "visible" || l.tailMode === "collapsed" || !a || De ? Kr(t, u) : (a = u, Oe(Dt, t), Oe(Lt, a), $t === null && ($t = t)), De && Ea(t, l.treeForkCount), e;
        }
        return at(t), null;
      case 22:
      case 23:
        return hn(t), Sf(), l = t.memoizedState !== null, e !== null ? e.memoizedState !== null !== l && (t.flags |= 8192) : l && (t.flags |= 8192), l ? (a & 536870912) !== 0 && (t.flags & 128) === 0 && (at(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : at(t), a = t.updateQueue, a !== null && Is(t, a.retryQueue), a = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), l = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), l !== a && (t.flags |= 2048), e !== null && Ae(Qo), null;
      case 24:
        return a = null, e !== null && (a = e.memoizedState.cache), t.memoizedState.cache !== a && (t.flags |= 2048), _a(vt), at(t), null;
      case 25:
        return null;
      case 30:
        return t.flags |= 33554432, at(t), null;
    }
    throw Error(c(156, t.tag));
  }
  function EC(e, t) {
    switch (lf(t), t.tag) {
      case 1:
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 3:
        return _a(vt), Vt(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
      case 26:
      case 27:
      case 5:
        return ga(t), null;
      case 31:
        if (t.memoizedState !== null) {
          if (hn(t), t.alternate === null) throw Error(c(340));
          qo();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 13:
        if (hn(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
          if (t.alternate === null) throw Error(c(340));
          qo();
        }
        return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 19:
        return wf(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
      case 4:
        return Vt(), null;
      case 10:
        return _a(t.type), null;
      case 22:
      case 23:
        return hn(t), Sf(), e !== null && Ae(Qo), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
      case 24:
        return _a(vt), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function zp(e, t) {
    switch (lf(t), t.tag) {
      case 3:
        _a(vt), Vt();
        break;
      case 26:
      case 27:
      case 5:
        ga(t);
        break;
      case 4:
        Vt();
        break;
      case 31:
        t.memoizedState !== null && hn(t);
        break;
      case 13:
        hn(t);
        break;
      case 19:
        wf(t);
        break;
      case 10:
        _a(t.type);
        break;
      case 22:
      case 23:
        hn(t), Sf(), e !== null && Ae(Qo);
        break;
      case 24:
        _a(vt);
    }
  }
  function ni(e, t) {
    try {
      var a = t.updateQueue, l = a !== null ? a.lastEffect : null;
      if (l !== null) {
        var s = l.next;
        a = s;
        do {
          if ((a.tag & e) === e) {
            l = void 0;
            var u = a.create, p = a.inst;
            l = u(), p.destroy = l;
          }
          a = a.next;
        } while (a !== s);
      }
    } catch (T) {
      Ze(t, t.return, T);
    }
  }
  function uo(e, t, a) {
    try {
      var l = t.updateQueue, s = l !== null ? l.lastEffect : null;
      if (s !== null) {
        var u = s.next;
        l = u;
        do {
          if ((l.tag & e) === e) {
            var p = l.inst, T = p.destroy;
            if (T !== void 0) {
              p.destroy = void 0, s = t;
              var z = a, Y = T;
              try {
                Y();
              } catch (F) {
                Ze(s, z, F);
              }
            }
          }
          l = l.next;
        } while (l !== u);
      }
    } catch (F) {
      Ze(t, t.return, F);
    }
  }
  function jp(e) {
    var t = e.updateQueue;
    if (t !== null) {
      var a = e.stateNode;
      try {
        T0(t, a);
      } catch (l) {
        Ze(e, e.return, l);
      }
    }
  }
  function Dp(e, t, a) {
    a.props = tl(e.type, e.memoizedProps), a.state = e.memoizedState;
    try {
      a.componentWillUnmount();
    } catch (l) {
      Ze(e, t, l);
    }
  }
  function ta(e, t) {
    try {
      var a = e.ref;
      if (a !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var l = e.stateNode;
            break;
          case 30:
            var s = e.stateNode, u = xa(e.memoizedProps, s);
            (s.ref === null || s.ref.name !== u) && (s.ref = qg(u)), l = s.ref;
            break;
          case 7:
            if (e.stateNode === null) {
              var p = new yn(e);
              v(e.child, !1, d2, p, void 0, void 0), e.stateNode = p;
            }
            l = e.stateNode;
            break;
          default:
            l = e.stateNode;
        }
        typeof a == "function" ? e.refCleanup = a(l) : a.current = l;
      }
    } catch (T) {
      Ze(e, t, T);
    }
  }
  function Bt(e, t) {
    var a = e.ref, l = e.refCleanup;
    if (a !== null) if (typeof l == "function") try {
      l();
    } catch (s) {
      Ze(e, t, s);
    } finally {
      e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
    }
    else if (typeof a == "function") try {
      a(null);
    } catch (s) {
      Ze(e, t, s);
    }
    else a.current = null;
  }
  function Qs(e, t) {
    if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var a = 0; a < t.length; a++) Zg(e.stateNode, t[a]);
  }
  function Lp(e) {
    for (var t = e.return; t !== null && (Wf(t) && Zg(e.stateNode, t.stateNode), !Jf(t)); )
      t = t.return;
  }
  function ai(e) {
    for (var t = e.return; t !== null && (Wf(t) && m2(e.stateNode, t.stateNode), !Jf(t)); )
      t = t.return;
  }
  function Jf(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 27;
  }
  function Wf(e) {
    return e && e.tag === 7 && e.stateNode !== null;
  }
  function ed(e) {
    var t = e.type, a = e.memoizedProps, l = e.stateNode;
    try {
      e: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          a.autoFocus && l.focus();
          break e;
        case "img":
          a.src ? l.src = a.src : a.srcSet && (l.srcset = a.srcSet);
      }
    } catch (s) {
      Ze(e, e.return, s);
    }
  }
  function td(e, t, a) {
    try {
      var l = e.stateNode;
      QC(l, e.type, a, t), l[Jt] = t;
    } catch (s) {
      Ze(e, e.return, s);
    }
  }
  function Bp(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && yo(e.type) || e.tag === 4;
  }
  function nd(e) {
    e: for (; ; ) {
      for (; e.sibling === null; ) {
        if (e.return === null || Bp(e.return)) return null;
        e = e.return;
      }
      for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
        if (e.tag === 27 && yo(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue e;
        e.child.return = e, e = e.child;
      }
      if (!(e.flags & 2)) return e.stateNode;
    }
  }
  function ad(e, t, a, l) {
    var s = e.tag;
    if (s === 5 || s === 6) s = e.stateNode, t ? (a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a).insertBefore(s, t) : (t = a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a, t.appendChild(s), a = a._reactRootContainer, a != null || t.onclick !== null || (t.onclick = Jn)), Qs(e, l), Ve = !0;
    else if (s !== 4 && (s === 27 && (Qs(e, l), l = null, yo(e.type) && (a = e.stateNode, t = null)), e = e.child, e !== null)) for (ad(e, t, a, l), e = e.sibling; e !== null; ) ad(e, t, a, l), e = e.sibling;
  }
  function Zs(e, t, a, l) {
    var s = e.tag;
    if (s === 5 || s === 6) s = e.stateNode, t ? a.insertBefore(s, t) : a.appendChild(s), Qs(e, l), Ve = !0;
    else if (s !== 4 && (s === 27 && (Qs(e, l), l = null, yo(e.type) && (a = e.stateNode)), e = e.child, e !== null)) for (Zs(e, t, a, l), e = e.sibling; e !== null; ) Zs(e, t, a, l), e = e.sibling;
  }
  function Hp(e) {
    var t = e.stateNode, a = e.memoizedProps;
    try {
      for (var l = e.type, s = t.attributes; s.length; ) t.removeAttributeNode(s[0]);
      Ht(t, l, a), t[zt] = e, t[Jt] = a;
    } catch (u) {
      Ze(e, e.return, u);
    }
  }
  var Ks = !1, vn = null;
  function kp(e) {
    (e.tag === 30 || (e.subtreeFlags & 33554432) !== 0) && (Ks = !0);
  }
  var na = null;
  function Up() {
    var e = na;
    return na = null, e;
  }
  var en = 0;
  function ql(e, t, a, l, s) {
    return en = 0, $p(e.child, t, a, l, s);
  }
  function $p(e, t, a, l, s) {
    for (var u = !1; e !== null; ) {
      if (e.tag === 5) {
        var p = e.stateNode;
        if (l !== null) {
          var T = Ud(p);
          l.push(T), T.view && (u = !0);
        } else u || Ud(p).view && (u = !0);
        Ks = !0, $g(p, en === 0 ? t : t + "_" + en, a), en++;
      } else (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && s || $p(e.child, t, a, l, s) && (u = !0));
      e = e.sibling;
    }
    return u;
  }
  function aa(e, t) {
    for (; e !== null; )
      e.tag === 5 ? Vg(e.stateNode, e.memoizedProps) : (e.tag !== 22 || e.memoizedState === null) && (e.tag === 30 && t || aa(e.child, t)), e = e.sibling;
  }
  function Fs(e) {
    if ((e.subtreeFlags & 18874368) !== 0) for (e = e.child; e !== null; ) {
      if ((e.tag !== 22 || e.memoizedState === null) && (Fs(e), e.tag === 30 && (e.flags & 18874368) !== 0 && e.stateNode.paired)) {
        var t = e.memoizedProps;
        if (t.name == null || t.name === "auto") throw Error(c(544));
        var a = t.name;
        t = wa(t.default, t.share), t !== "none" && (ql(e, a, t, null, !1) || aa(e.child, !1));
      }
      e = e.sibling;
    }
  }
  function od(e, t) {
    if (e.tag === 30) {
      var a = e.stateNode, l = e.memoizedProps, s = xa(l, a), u = wa(l.default, a.paired ? l.share : l.enter);
      u !== "none" ? ql(e, s, u, null, !1) ? (Fs(e), a.paired || t || Fl(e, l.onEnter)) : aa(e.child, !1) : Fs(e);
    } else if ((e.subtreeFlags & 33554432) !== 0) for (e = e.child; e !== null; ) od(e, t), e = e.sibling;
    else Fs(e);
  }
  function ld(e) {
    if (vn !== null && vn.size !== 0) {
      var t = vn;
      if ((e.subtreeFlags & 18874368) !== 0) for (e = e.child; e !== null; ) {
        if (e.tag !== 22 || e.memoizedState === null) {
          if (e.tag === 30 && (e.flags & 18874368) !== 0) {
            var a = e.memoizedProps, l = a.name;
            if (l != null && l !== "auto") {
              var s = t.get(l);
              if (s !== void 0) {
                var u = wa(a.default, a.share);
                if (u !== "none" && (ql(e, l, u, null, !1) ? (u = e.stateNode, s.paired = u, u.paired = s, Fl(e, a.onShare)) : aa(e.child, !1)), t.delete(l), t.size === 0) break;
              }
            }
          }
          ld(e);
        }
        e = e.sibling;
      }
    }
  }
  function rd(e) {
    if (e.tag === 30) {
      var t = e.memoizedProps, a = xa(t, e.stateNode), l = vn !== null ? vn.get(a) : void 0, s = wa(t.default, l !== void 0 ? t.share : t.exit);
      s !== "none" && (ql(e, a, s, null, !1) ? l !== void 0 ? (s = e.stateNode, l.paired = s, s.paired = l, vn.delete(a), Fl(e, t.onShare)) : Fl(e, t.onExit) : aa(e.child, !1)), vn !== null && ld(e);
    } else if ((e.subtreeFlags & 33554432) !== 0) for (e = e.child; e !== null; ) rd(e), e = e.sibling;
    else vn !== null && ld(e);
  }
  function Vp(e) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var t = e.memoizedProps, a = xa(t, e.stateNode);
        t = wa(t.default, t.update), e.flags &= -5, t !== "none" && ql(e, a, t, e.memoizedState = [], !1);
      } else (e.subtreeFlags & 33554432) !== 0 && Vp(e);
      e = e.sibling;
    }
  }
  function id(e) {
    if ((e.subtreeFlags & 18874368) !== 0) for (e = e.child; e !== null; ) {
      if (e.tag !== 22 || e.memoizedState === null) {
        if (e.tag === 30 && (e.flags & 18874368) !== 0) {
          var t = e.stateNode;
          t.paired !== null && (t.paired = null, aa(e.child, !1));
        }
        id(e);
      }
      e = e.sibling;
    }
  }
  function Js(e) {
    if (e.tag === 30) e.stateNode.paired = null, aa(e.child, !1), id(e);
    else if ((e.subtreeFlags & 33554432) !== 0) for (e = e.child; e !== null; ) Js(e), e = e.sibling;
    else id(e);
  }
  function Yp(e) {
    for (e = e.child; e !== null; ) e.tag === 30 ? aa(e.child, !1) : (e.subtreeFlags & 33554432) !== 0 && Yp(e), e = e.sibling;
  }
  function sd(e, t, a, l, s, u, p) {
    for (var T = !1; t !== null; ) {
      if (t.tag === 5) {
        var z = t.stateNode;
        if (u !== null && en < u.length) {
          var Y = u[en], F = Ud(z);
          (Y.view || F.view) && (T = !0);
          var le;
          if (le = (e.flags & 4) === 0) if (F.clip) le = !0;
          else {
            le = Y.rect;
            var U = F.rect;
            le = le.y !== U.y || le.x !== U.x || le.height !== U.height || le.width !== U.width;
          }
          le && (e.flags |= 4), F.abs ? F = !Y.abs : (Y = Y.rect, F = F.rect, F = Y.height !== F.height || Y.width !== F.width), F && (e.flags |= 32);
        } else e.flags |= 32;
        (e.flags & 4) !== 0 && $g(z, en === 0 ? a : a + "_" + en, s), T && (e.flags & 4) !== 0 || (na === null && (na = []), na.push(z, en === 0 ? l : l + "_" + en, t.memoizedProps)), en++;
      } else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && p ? e.flags |= t.flags & 32 : sd(e, t.child, a, l, s, u, p) && (T = !0));
      t = t.sibling;
    }
    return T;
  }
  function qp(e, t) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var a = e.memoizedProps, l = e.stateNode, s = xa(a, l), u = wa(a.default, a.update);
        if (t) {
          l = l.clones;
          var p = l === null ? null : l.map(e2);
        } else p = e.memoizedState, e.memoizedState = null;
        l = e;
        var T = e.child;
        en = 0, s = sd(l, T, s, s, u, p, !1), (e.flags & 4) !== 0 && s && (t || Fl(e, a.onUpdate));
      } else (e.subtreeFlags & 33554432) !== 0 && qp(e, t);
      e = e.sibling;
    }
  }
  var Nt = !1, Ie = !1, oa = !1, cd = !1, Gp = typeof WeakSet == "function" ? WeakSet : Set, Ot = null, la = !1, oi = !1, Ws = !1, ud = !1;
  function TC(e, t, a) {
    if (e = e.containerInfo, Dd = ir, e = Fv(e), Zu(e)) {
      if ("selectionStart" in e) var l = {
        start: e.selectionStart,
        end: e.selectionEnd
      };
      else e: {
        l = (l = e.ownerDocument) && l.defaultView || window;
        var s = l.getSelection && l.getSelection();
        if (s && s.rangeCount !== 0) {
          l = s.anchorNode;
          var u = s.anchorOffset, p = s.focusNode;
          s = s.focusOffset;
          try {
            l.nodeType, p.nodeType;
          } catch {
            l = null;
            break e;
          }
          var T = 0, z = -1, Y = -1, F = 0, le = 0, U = e, K = null;
          t: for (; ; ) {
            for (var be; U !== l || u !== 0 && U.nodeType !== 3 || (z = T + u), U !== p || s !== 0 && U.nodeType !== 3 || (Y = T + s), U.nodeType === 3 && (T += U.nodeValue.length), (be = U.firstChild) !== null; )
              K = U, U = be;
            for (; ; ) {
              if (U === e) break t;
              if (K === l && ++F === u && (z = T), K === p && ++le === s && (Y = T), (be = U.nextSibling) !== null) break;
              U = K, K = U.parentNode;
            }
            U = be;
          }
          l = z === -1 || Y === -1 ? null : {
            start: z,
            end: Y
          };
        } else l = null;
      }
      l = l || {
        start: 0,
        end: 0
      };
    } else l = null;
    for (Ld = {
      focusedElem: e,
      selectionRange: l
    }, ir = !1, a = (a & 335544064) === a, Ot = t, t = a ? 9270 : 1024; Ot !== null; ) {
      if (e = Ot, a && (l = e.deletions, l !== null)) for (u = 0; u < l.length; u++) a && rd(l[u]);
      if (e.alternate === null && (e.flags & 2) !== 0) a && kp(e), ec(a);
      else {
        if (e.tag === 22) {
          if (l = e.alternate, e.memoizedState !== null) {
            l !== null && l.memoizedState === null && a && rd(l), ec(a);
            continue;
          } else if (l !== null && l.memoizedState !== null) {
            a && kp(e), ec(a);
            continue;
          }
        }
        l = e.child, (e.subtreeFlags & t) !== 0 && l !== null ? (l.return = e, Ot = l) : (a && Vp(e), ec(a));
      }
    }
    vn = null;
  }
  function ec(e) {
    for (; Ot !== null; ) {
      var t = Ot, a = e, l = t.alternate, s = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if ((s & 1024) !== 0 && l !== null) {
            a = void 0, s = l.memoizedProps, l = l.memoizedState;
            var u = t.stateNode;
            try {
              var p = tl(t.type, s);
              a = u.getSnapshotBeforeUpdate(p, l), u.__reactInternalSnapshotBeforeUpdate = a;
            } catch (T) {
              Ze(t, t.return, T);
            }
          }
          break;
        case 3:
          if ((s & 1024) !== 0) {
            if (l = t.stateNode.containerInfo, a = l.nodeType, a === 9) Yd(l);
            else if (a === 1) switch (l.nodeName) {
              case "HEAD":
              case "HTML":
              case "BODY":
                Yd(l);
                break;
              default:
                l.textContent = "";
            }
          }
          break;
        case 5:
        case 26:
        case 27:
        case 6:
        case 4:
        case 17:
          break;
        case 30:
          a && l !== null && (a = xa(l.memoizedProps, l.stateNode), s = t.memoizedProps, s = wa(s.default, s.update), s !== "none" && ql(l, a, s, l.memoizedState = [], !0));
          break;
        default:
          if ((s & 1024) !== 0) throw Error(c(163));
      }
      if (l = t.sibling, l !== null) {
        l.return = t.return, Ot = l;
        break;
      }
      Ot = t.return;
    }
  }
  function Pp(e, t, a) {
    var l = a.flags;
    switch (a.tag) {
      case 0:
      case 11:
      case 15:
        ra(e, a), l & 4 && ni(5, a);
        break;
      case 1:
        if (ra(e, a), l & 4) if (e = a.stateNode, t === null) try {
          e.componentDidMount();
        } catch (p) {
          Ze(a, a.return, p);
        }
        else {
          var s = tl(a.type, t.memoizedProps);
          t = t.memoizedState;
          try {
            e.componentDidUpdate(s, t, e.__reactInternalSnapshotBeforeUpdate);
          } catch (p) {
            Ze(a, a.return, p);
          }
        }
        l & 64 && jp(a), l & 512 && ta(a, a.return);
        break;
      case 3:
        if (ra(e, a), l & 64 && (e = a.updateQueue, e !== null)) {
          if (t = null, a.child !== null) switch (a.child.tag) {
            case 27:
            case 5:
              t = a.child.stateNode;
              break;
            case 1:
              t = a.child.stateNode;
          }
          try {
            T0(e, t);
          } catch (p) {
            Ze(a, a.return, p);
          }
        }
        break;
      case 27:
        t === null && l & 4 && Hp(a);
      case 26:
      case 5:
        ra(e, a), t === null && l & 4 && ed(a), l & 512 && ta(a, a.return);
        break;
      case 12:
        ra(e, a);
        break;
      case 31:
        ra(e, a), l & 4 && Zp(e, a);
        break;
      case 13:
        ra(e, a), l & 4 && Kp(e, a), l & 64 && (e = a.memoizedState, e !== null && (e = e.dehydrated, e !== null && (a = HC.bind(null, a), p2(e, a))));
        break;
      case 22:
        if (l = a.memoizedState !== null || Nt, !l) {
          var u = t !== null && t.memoizedState !== null || Ie;
          t = Nt, s = Ie, Nt = l, (Ie = u) && !s ? (l = 2, (a.subtreeFlags & 8772) !== 0 && (l |= 1), Yn(e, a, l)) : ra(e, a), Nt = t, Ie = s;
        }
        break;
      case 30:
        ra(e, a), l & 512 && ta(a, a.return);
        break;
      case 7:
        l & 512 && ta(a, a.return);
      default:
        ra(e, a);
    }
  }
  function fd(e, t) {
    for (e = e.child; e !== null; ) Xp(e, t), e = e.sibling;
  }
  function Xp(e, t) {
    switch (e.tag) {
      case 5:
      case 26:
        try {
          var a = e.stateNode;
          if (t) {
            var l = a.style;
            typeof l.setProperty == "function" ? l.setProperty("display", "none", "important") : l.display = "none";
          } else {
            var s = e.stateNode, u = e.memoizedProps.style, p = u != null && u.hasOwnProperty("display") ? u.display : null;
            s.style.display = p == null || typeof p == "boolean" ? "" : ("" + p).trim();
          }
        } catch (z) {
          Ze(e, e.return, z);
        }
        dd(e, t);
        break;
      case 6:
        try {
          e.stateNode.nodeValue = t ? "" : e.memoizedProps, Ve = !0;
        } catch (z) {
          Ze(e, e.return, z);
        }
        break;
      case 18:
        try {
          var T = e.stateNode;
          t ? Ug(T, !0) : Ug(e.stateNode, !1);
        } catch (z) {
          Ze(e, e.return, z);
        }
        break;
      case 22:
      case 23:
        e.memoizedState === null && fd(e, t);
        break;
      default:
        fd(e, t);
    }
  }
  function dd(e, t) {
    if (e.subtreeFlags & 67108864) for (e = e.child; e !== null; ) {
      e: {
        var a = e, l = t;
        switch (a.tag) {
          case 4:
            Xp(a, l);
            break e;
          case 22:
            a.memoizedState === null && dd(a, l);
            break e;
          default:
            dd(a, l);
        }
      }
      e = e.sibling;
    }
  }
  function Ip(e) {
    var t = e.alternate;
    t !== null && (e.alternate = null, Ip(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && ls(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
  }
  var rt = null, tn = !1;
  function $n(e, t, a) {
    for (a = a.child; a !== null; ) Qp(e, t, a), a = a.sibling;
  }
  function Qp(e, t, a) {
    if (un && typeof un.onCommitFiberUnmount == "function") try {
      un.onCommitFiberUnmount(Rr, a);
    } catch {
    }
    switch (a.tag) {
      case 26:
        Ie || Bt(a, t), $n(e, t, a), a.memoizedState ? a.memoizedState.count-- : a.stateNode && !Ie && (a = a.stateNode, a.parentNode.removeChild(a));
        break;
      case 27:
        Ie || Bt(a, t), ai(a);
        var l = rt, s = tn;
        yo(a.type) && (rt = a.stateNode, tn = !1), $n(e, t, a), ey(a.stateNode, a.type, a.memoizedProps), rt = l, tn = s;
        break;
      case 5:
        Ie || Bt(a, t), ai(a);
      case 6:
        if (a.tag === 6 && ai(a), l = rt, s = tn, rt = null, $n(e, t, a), rt = l, tn = s, rt !== null) if (tn) try {
          (rt.nodeType === 9 ? rt.body : rt.nodeName === "HTML" ? rt.ownerDocument.body : rt).removeChild(a.stateNode), Ve = !0;
        } catch (u) {
          Ze(a, t, u);
        }
        else try {
          rt.removeChild(a.stateNode), Ve = !0;
        } catch (u) {
          Ze(a, t, u);
        }
        break;
      case 18:
        rt !== null && (tn ? (e = rt, kg(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, a.stateNode), sr(e)) : kg(rt, a.stateNode));
        break;
      case 4:
        l = rt, s = tn, rt = a.stateNode.containerInfo, tn = !0, $n(e, t, a), rt = l, tn = s;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        uo(2, a, t), Ie || uo(4, a, t), $n(e, t, a);
        break;
      case 1:
        Ie || (Bt(a, t), l = a.stateNode, typeof l.componentWillUnmount == "function" && Dp(a, t, l)), $n(e, t, a);
        break;
      case 21:
        $n(e, t, a);
        break;
      case 22:
        Ie = (l = Ie) || a.memoizedState !== null, $n(e, t, a), Ie = l;
        break;
      case 30:
        Bt(a, t), $n(e, t, a);
        break;
      case 7:
        Ie || Bt(a, t), $n(e, t, a);
        break;
      default:
        $n(e, t, a);
    }
  }
  function Zp(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
      e = e.dehydrated;
      try {
        sr(e);
      } catch (a) {
        Ze(t, t.return, a);
      }
    }
  }
  function Kp(e, t) {
    if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
      sr(e);
    } catch (a) {
      Ze(t, t.return, a);
    }
  }
  function _C(e) {
    switch (e.tag) {
      case 31:
      case 13:
      case 19:
        var t = e.stateNode;
        return t === null && (t = e.stateNode = new Gp()), t;
      case 22:
        return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new Gp()), t;
      default:
        throw Error(c(435, e.tag));
    }
  }
  function tc(e, t) {
    var a = _C(e);
    t.forEach(function(l) {
      if (!a.has(l)) {
        a.add(l);
        var s = kC.bind(null, e, l);
        l.then(s, s);
      }
    });
  }
  function Pt(e, t, a) {
    var l = t.deletions;
    if (l !== null) for (var s = 0; s < l.length; s++) {
      var u = l[s], p = e, T = t, z = T;
      e: for (; z !== null; ) {
        switch (z.tag) {
          case 27:
            if (yo(z.type)) {
              rt = z.stateNode, tn = !1;
              break e;
            }
            break;
          case 5:
            rt = z.stateNode, tn = !1;
            break e;
          case 3:
          case 4:
            rt = z.stateNode.containerInfo, tn = !0;
            break e;
        }
        z = z.return;
      }
      if (rt === null) throw Error(c(160));
      Qp(p, T, u), rt = null, tn = !1, p = u.alternate, p !== null && (p.return = null), u.return = null;
    }
    if (t.subtreeFlags & 13886) for (t = t.child; t !== null; ) Fp(t, e, a), t = t.sibling;
  }
  var Vn = null;
  function Fp(e, t, a) {
    var l = e.alternate, s = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (s & 4 && (l = e.updateQueue, l = l !== null ? l.events : null, l !== null)) for (var u = 0; u < l.length; u++) {
          var p = l[u];
          p.ref.impl = p.nextImpl;
        }
        Pt(t, e, a), Xt(e), s & 4 && (uo(3, e, e.return), ni(3, e), uo(5, e, e.return));
        break;
      case 1:
        Pt(t, e, a), Xt(e), s & 512 && (Ie || l === null || Bt(l, l.return)), s & 64 && Nt && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (a = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = a === null ? t : a.concat(t))));
        break;
      case 26:
        if (u = Vn, Pt(t, e, a), Xt(e), s & 512 && (Ie || l === null || Bt(l, l.return)), s & 4) if (s = l !== null ? l.memoizedState : null, a = e.memoizedState, l === null) if (a === null) if (e.stateNode === null) if (Nt) e.stateNode = Lg(e.type, e.memoizedProps, t.containerInfo, e);
        else {
          e: {
            t = e.type, a = e.memoizedProps, s = u.ownerDocument || u;
            t: switch (t) {
              case "title":
                l = s.getElementsByTagName("title")[0], (!l || l[Or] || l[zt] || l.namespaceURI === "http://www.w3.org/2000/svg" || l.hasAttribute("itemprop")) && (l = s.createElement(t), s.head.insertBefore(l, s.querySelector("head > title"))), Ht(l, t, a), l[zt] = e, Rt(l), t = l;
                break e;
              case "link":
                if (u = ry("link", "href", s).get(t + (a.href || ""))) {
                  for (p = 0; p < u.length; p++) if (l = u[p], l.getAttribute("href") === (a.href == null || a.href === "" ? null : a.href) && l.getAttribute("rel") === (a.rel == null ? null : a.rel) && l.getAttribute("title") === (a.title == null ? null : a.title) && l.getAttribute("crossorigin") === (a.crossOrigin == null ? null : a.crossOrigin)) {
                    u.splice(p, 1);
                    break t;
                  }
                }
                l = s.createElement(t), Ht(l, t, a), s.head.appendChild(l);
                break;
              case "meta":
                if (u = ry("meta", "content", s).get(t + (a.content || ""))) {
                  for (p = 0; p < u.length; p++) if (l = u[p], l.getAttribute("content") === (a.content == null ? null : "" + a.content) && l.getAttribute("name") === (a.name == null ? null : a.name) && l.getAttribute("property") === (a.property == null ? null : a.property) && l.getAttribute("http-equiv") === (a.httpEquiv == null ? null : a.httpEquiv) && l.getAttribute("charset") === (a.charSet == null ? null : a.charSet)) {
                    u.splice(p, 1);
                    break t;
                  }
                }
                l = s.createElement(t), Ht(l, t, a), s.head.appendChild(l);
                break;
              default:
                throw Error(c(468, t));
            }
            l[zt] = e, Rt(l), t = l;
          }
          e.stateNode = t;
        }
        else Nt || Zd(u, e.type, e.stateNode);
        else e.stateNode = ly(u, a, e.memoizedProps);
        else s !== a ? (s === null ? (t = l.stateNode, t === null || Ie || t.parentNode.removeChild(t)) : s.count--, a === null ? Nt || Zd(u, e.type, e.stateNode) : ly(u, a, e.memoizedProps)) : a === null && e.stateNode !== null && td(e, e.memoizedProps, l.memoizedProps);
        break;
      case 27:
        Pt(t, e, a), Xt(e), s & 512 && (Ie || l === null || Bt(l, l.return)), l !== null && s & 4 && td(e, e.memoizedProps, l.memoizedProps);
        break;
      case 5:
        if (u = oa, oa = !1, Pt(t, e, a), oa = u, Xt(e), s & 512 && (Ie || l === null || Bt(l, l.return)), e.flags & 32) {
          t = e.stateNode;
          try {
            Tl(t, ""), Ve = !0;
          } catch (F) {
            Ze(e, e.return, F);
          }
        }
        s & 4 && e.stateNode != null && (t = e.memoizedProps, td(e, t, l !== null ? l.memoizedProps : t)), s & 1024 && (cd = !0);
        break;
      case 6:
        if (Pt(t, e, a), Xt(e), s & 4) {
          if (e.stateNode === null) throw Error(c(162));
          t = e.memoizedProps, a = e.stateNode;
          try {
            a.nodeValue = t, Ve = !0;
          } catch (F) {
            Ze(e, e.return, F);
          }
        }
        break;
      case 3:
        if (Ve = !1, pc = null, u = Vn, Vn = mi(t.containerInfo), Pt(t, e, a), Vn = u, Xt(e), s & 4 && l !== null && l.memoizedState.isDehydrated) try {
          sr(t.containerInfo);
        } catch (F) {
          Ze(e, e.return, F);
        }
        cd && (cd = !1, Jp(e)), Ve = !1;
        break;
      case 4:
        s = oa, oa = Nt, l = xv(), u = Vn, Vn = mi(e.stateNode.containerInfo), Pt(t, e, a), Xt(e), Vn = u, Ve && oi && (Ws = !0), Ve = l, oa = s;
        break;
      case 12:
        Pt(t, e, a), Xt(e);
        break;
      case 31:
        Pt(t, e, a), Xt(e), s & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, tc(e, t)));
        break;
      case 13:
        Pt(t, e, a), Xt(e), e.child.flags & 8192 && e.memoizedState !== null != (l !== null && l.memoizedState !== null) && (oc = Yt()), s & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, tc(e, t)));
        break;
      case 22:
        u = e.memoizedState !== null, p = l !== null && l.memoizedState !== null;
        var T = Nt, z = Ie, Y = oa;
        Nt = T || u, oa = Y || u, Ie = z || p, Pt(t, e, a), Ie = z, oa = Y, Nt = T, Xt(e), s & 8192 && (t = e.stateNode, t._visibility = u ? t._visibility & -2 : t._visibility | 1, !u || l === null || p || Nt || Ie || (t = p || Ie, a = Nt, l = Ie, Nt = u || Nt, Ie = t, fo(e, 2), Nt = a, Ie = l), !u && oa || fd(e, u)), s & 4 && (t = e.updateQueue, t !== null && (a = t.retryQueue, a !== null && (t.retryQueue = null, tc(e, a))));
        break;
      case 19:
        Pt(t, e, a), Xt(e), s & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, tc(e, t)));
        break;
      case 30:
        s & 512 && (Ie || l === null || Bt(l, l.return)), s = xv(), u = oi, p = (a & 335544064) === a, T = e.memoizedProps, oi = p && wa(T.default, T.update) !== "none", Pt(t, e, a), Xt(e), p && l !== null && Ve && (e.flags |= 4), oi = u, Ve = s;
        break;
      case 21:
        break;
      case 7:
        s & 512 && (Ie || l === null || Bt(l, l.return)), l && l.stateNode !== null && (l.stateNode._fragmentFiber = e);
      default:
        Pt(t, e, a), Xt(e);
    }
  }
  function Xt(e) {
    var t = e.flags;
    if (t & 2) {
      try {
        for (var a, l = e.return; l !== null; ) {
          if (Bp(l)) {
            a = l;
            break;
          }
          l = l.return;
        }
        l = null;
        for (var s = e.return; s !== null; ) {
          if (Wf(s)) {
            var u = s.stateNode;
            l === null ? l = [u] : l.push(u);
          }
          if (Jf(s)) break;
          s = s.return;
        }
        var p = l;
        if (a == null) throw Error(c(160));
        switch (a.tag) {
          case 27:
            var T = a.stateNode;
            Zs(e, nd(e), T, p);
            break;
          case 5:
            var z = a.stateNode;
            a.flags & 32 && (Tl(z, ""), a.flags &= -33), Zs(e, nd(e), z, p);
            break;
          case 3:
          case 4:
            var Y = a.stateNode.containerInfo;
            ad(e, nd(e), Y, p);
            break;
          default:
            throw Error(c(161));
        }
      } catch (F) {
        Ze(e, e.return, F);
      }
      e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
  }
  function Jp(e) {
    if (e.subtreeFlags & 1024) for (e = e.child; e !== null; ) {
      var t = e;
      Jp(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, ir = !0, t.reset(), ir = !1), e = e.sibling;
    }
  }
  function Gl(e, t) {
    if (t.subtreeFlags & 9270) for (t = t.child; t !== null; ) Wp(t, e), t = t.sibling;
    else qp(t, !1);
  }
  function Wp(e, t) {
    var a = e.alternate;
    if (a === null) od(e, !1);
    else switch (e.tag) {
      case 3:
        if (ud = la = !1, Up(), Gl(t, e), !la && !Ws) {
          if (e = na, e !== null) for (var l = 0; l < e.length; l += 3) {
            a = e[l];
            var s = e[l + 1];
            Vg(a, e[l + 2]), a = a.ownerDocument.documentElement, a !== null && a.animate({
              opacity: [0, 0],
              pointerEvents: ["none", "none"]
            }, {
              duration: 0,
              fill: "forwards",
              pseudoElement: "::view-transition-group(" + s + ")"
            });
          }
          e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
            opacity: [0, 0],
            pointerEvents: ["none", "none"]
          }, {
            duration: 0,
            fill: "forwards",
            pseudoElement: "::view-transition-group(root)"
          }), e.animate({
            width: [0, 0],
            height: [0, 0]
          }, {
            duration: 0,
            fill: "forwards",
            pseudoElement: "::view-transition"
          })), ud = !0;
        }
        na = null;
        break;
      case 5:
        Gl(t, e);
        break;
      case 4:
        l = la, la = !1, Gl(t, e), la && (Ws = !0), la = l;
        break;
      case 22:
        e.memoizedState === null && (a.memoizedState !== null ? od(e, !1) : Gl(t, e));
        break;
      case 30:
        l = la, s = Up(), la = !1, Gl(t, e), la && (e.flags |= 4);
        var u = e.memoizedProps, p = e.stateNode;
        t = xa(u, p), p = xa(a.memoizedProps, p);
        var T = wa(u.default, u.update);
        T === "none" ? t = !1 : (u = a.memoizedState, a.memoizedState = null, a = e.child, en = 0, t = sd(e, a, t, p, T, u, !0), en !== (u === null ? 0 : u.length) && (e.flags |= 32)), (e.flags & 4) !== 0 && t ? (Fl(e, e.memoizedProps.onUpdate), na = s) : s !== null && (s.push.apply(s, na), na = s), la = (e.flags & 32) !== 0 ? !0 : l;
        break;
      default:
        Gl(t, e);
    }
  }
  function ra(e, t) {
    if (t.subtreeFlags & 8772) for (t = t.child; t !== null; ) Pp(e, t.alternate, t), t = t.sibling;
  }
  function fo(e, t) {
    for (e = e.child; e !== null; ) {
      var a = e, l = t;
      switch (a.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          uo(4, a, a.return), fo(a, l);
          break;
        case 1:
          Bt(a, a.return);
          var s = a.stateNode;
          typeof s.componentWillUnmount == "function" && Dp(a, a.return, s), fo(a, l);
          break;
        case 27:
          (l & 2) !== 0 && ey(a.stateNode, a.type, a.memoizedProps);
        case 5:
          Bt(a, a.return), a.tag !== 5 && a.tag !== 27 || ai(a), fo(a, l);
          break;
        case 6:
          ai(a);
          break;
        case 26:
          Bt(a, a.return), s = a.stateNode, a.memoizedState !== null || s === null || Ie || s.parentNode.removeChild(s), fo(a, l);
          break;
        case 22:
          a.memoizedState === null && fo(a, l);
          break;
        case 30:
          Bt(a, a.return), fo(a, l);
          break;
        case 7:
          Bt(a, a.return);
        default:
          fo(a, l);
      }
      e = e.sibling;
    }
  }
  function Yn(e, t, a) {
    for (a = (t.subtreeFlags & 8772) !== 0 ? a : a & -2, t = t.child; t !== null; ) {
      var l = t.alternate, s = e, u = t, p = u.flags, T = (a & 1) !== 0;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          Yn(s, u, a), ni(4, u);
          break;
        case 1:
          if (Yn(s, u, a), l = u, s = l.stateNode, typeof s.componentDidMount == "function") try {
            s.componentDidMount();
          } catch (F) {
            Ze(l, l.return, F);
          }
          if (l = u, s = l.updateQueue, s !== null) {
            var z = l.stateNode;
            try {
              var Y = s.shared.hiddenCallbacks;
              if (Y !== null) for (s.shared.hiddenCallbacks = null, s = 0; s < Y.length; s++) E0(Y[s], z);
            } catch (F) {
              Ze(l, l.return, F);
            }
          }
          T && p & 64 && jp(u), ta(u, u.return);
          break;
        case 27:
          (a & 2) !== 0 && Hp(u);
        case 5:
          u.tag !== 5 && u.tag !== 27 || Lp(u), Yn(s, u, a), T && l === null && p & 4 && ed(u), ta(u, u.return);
          break;
        case 6:
          Lp(u);
          break;
        case 26:
          z = u.stateNode, u.memoizedState !== null || z === null || Nt || Zd(mi(z.ownerDocument), u.type, z), Yn(s, u, a), T && l === null && p & 4 && ed(u), ta(u, u.return);
          break;
        case 12:
          Yn(s, u, a);
          break;
        case 31:
          Yn(s, u, a), T && p & 4 && Zp(s, u);
          break;
        case 13:
          Yn(s, u, a), T && p & 4 && Kp(s, u);
          break;
        case 22:
          u.memoizedState === null && Yn(s, u, a), ta(u, u.return);
          break;
        case 30:
          Yn(s, u, a), ta(u, u.return);
          break;
        case 7:
          ta(u, u.return);
        default:
          Yn(s, u, a);
      }
      t = t.sibling;
    }
  }
  function md(e, t) {
    var a = null;
    e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== a && (e != null && e.refCount++, a != null && qr(a));
  }
  function hd(e, t) {
    e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && qr(e));
  }
  function Mn(e, t, a, l) {
    var s = (a & 335544064) === a;
    if (t.subtreeFlags & (s ? 10262 : 10256)) for (t = t.child; t !== null; ) eg(e, t, a, l), t = t.sibling;
    else s && Yp(t);
  }
  function eg(e, t, a, l) {
    var s = (a & 335544064) === a;
    s && t.alternate === null && t.return !== null && t.return.alternate !== null && Js(t);
    var u = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        Mn(e, t, a, l), u & 2048 && ni(9, t);
        break;
      case 1:
        Mn(e, t, a, l);
        break;
      case 3:
        Mn(e, t, a, l), s && ud && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), u & 2048 && (u = null, t.alternate !== null && (u = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== u && (t.refCount++, u != null && qr(u)));
        break;
      case 12:
        if (u & 2048) {
          Mn(e, t, a, l), u = t.stateNode;
          try {
            var p = t.memoizedProps, T = p.id, z = p.onPostCommit;
            typeof z == "function" && z(T, t.alternate === null ? "mount" : "update", u.passiveEffectDuration, -0);
          } catch (Y) {
            Ze(t, t.return, Y);
          }
        } else Mn(e, t, a, l);
        break;
      case 31:
        Mn(e, t, a, l);
        break;
      case 13:
        Mn(e, t, a, l);
        break;
      case 23:
        break;
      case 22:
        p = t.stateNode, T = t.alternate, t.memoizedState !== null ? (s && T !== null && T.memoizedState === null && Js(T), p._visibility & 2 ? Mn(e, t, a, l) : li(e, t)) : (s && T !== null && T.memoizedState !== null && Js(t), p._visibility & 2 ? Mn(e, t, a, l) : (p._visibility |= 2, Pl(e, t, a, l, (t.subtreeFlags & 10256) !== 0 || !1))), u & 2048 && md(T, t);
        break;
      case 24:
        Mn(e, t, a, l), u & 2048 && hd(t.alternate, t);
        break;
      case 30:
        s && (u = t.alternate, u !== null && (aa(u.child, !0), aa(t.child, !0))), Mn(e, t, a, l);
        break;
      default:
        Mn(e, t, a, l);
    }
  }
  function Pl(e, t, a, l, s) {
    for (s = s && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child; t !== null; ) {
      var u = e, p = t, T = a, z = l, Y = p.flags;
      switch (p.tag) {
        case 0:
        case 11:
        case 15:
          Pl(u, p, T, z, s), ni(8, p);
          break;
        case 23:
          break;
        case 22:
          var F = p.stateNode;
          p.memoizedState !== null ? F._visibility & 2 ? Pl(u, p, T, z, s) : li(u, p) : (F._visibility |= 2, Pl(u, p, T, z, s)), s && Y & 2048 && md(p.alternate, p);
          break;
        case 24:
          Pl(u, p, T, z, s), s && Y & 2048 && hd(p.alternate, p);
          break;
        default:
          Pl(u, p, T, z, s);
      }
      t = t.sibling;
    }
  }
  function li(e, t) {
    if (t.subtreeFlags & 10256) for (t = t.child; t !== null; ) {
      var a = e, l = t, s = l.flags;
      switch (l.tag) {
        case 22:
          li(a, l), s & 2048 && md(l.alternate, l);
          break;
        case 24:
          li(a, l), s & 2048 && hd(l.alternate, l);
          break;
        default:
          li(a, l);
      }
      t = t.sibling;
    }
  }
  var nl = 8192;
  function al(e, t, a) {
    if (e.subtreeFlags & nl) for (e = e.child; e !== null; ) tg(e, t, a), e = e.sibling;
  }
  function tg(e, t, a) {
    switch (e.tag) {
      case 26:
        al(e, t, a), e.flags & nl && (e.memoizedState !== null ? O2(a, Vn, e.memoizedState, e.memoizedProps) : (e = e.stateNode, (t & 335544128) === t && uy(a, e)));
        break;
      case 5:
        al(e, t, a), e.flags & nl && (e = e.stateNode, (t & 335544128) === t && uy(a, e));
        break;
      case 3:
      case 4:
        var l = Vn;
        Vn = mi(e.stateNode.containerInfo), al(e, t, a), Vn = l;
        break;
      case 22:
        e.memoizedState === null && (l = e.alternate, l !== null && l.memoizedState !== null ? (l = nl, nl = 16777216, al(e, t, a), nl = l) : al(e, t, a));
        break;
      case 30:
        if ((e.flags & nl) !== 0 && (l = e.memoizedProps.name, l != null && l !== "auto")) {
          var s = e.stateNode;
          s.paired = null, vn === null && (vn = /* @__PURE__ */ new Map()), vn.set(l, s);
        }
        al(e, t, a);
        break;
      default:
        al(e, t, a);
    }
  }
  function ng(e) {
    var t = e.alternate;
    if (t !== null && (e = t.child, e !== null)) {
      t.child = null;
      do
        t = e.sibling, e.sibling = null, e = t;
      while (e !== null);
    }
  }
  function ri(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null) for (var a = 0; a < t.length; a++) {
        var l = t[a];
        Ot = l, og(l, e);
      }
      ng(e);
    }
    if (e.subtreeFlags & 10256) for (e = e.child; e !== null; ) ag(e), e = e.sibling;
  }
  function ag(e) {
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        ri(e), e.flags & 2048 && uo(9, e, e.return);
        break;
      case 3:
        ri(e);
        break;
      case 12:
        ri(e);
        break;
      case 22:
        var t = e.stateNode;
        e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, nc(e)) : ri(e);
        break;
      default:
        ri(e);
    }
  }
  function nc(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null) for (var a = 0; a < t.length; a++) {
        var l = t[a];
        Ot = l, og(l, e);
      }
      ng(e);
    }
    for (e = e.child; e !== null; ) {
      switch (t = e, t.tag) {
        case 0:
        case 11:
        case 15:
          uo(8, t, t.return), nc(t);
          break;
        case 22:
          a = t.stateNode, a._visibility & 2 && (a._visibility &= -3, nc(t));
          break;
        default:
          nc(t);
      }
      e = e.sibling;
    }
  }
  function og(e, t) {
    for (; Ot !== null; ) {
      var a = Ot;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          uo(8, a, t);
          break;
        case 23:
        case 22:
          if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
            var l = a.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          qr(a.memoizedState.cache);
      }
      if (l = a.child, l !== null) l.return = a, Ot = l;
      else e: for (a = e; Ot !== null; ) {
        l = Ot;
        var s = l.sibling, u = l.return;
        if (Ip(l), l === a) {
          Ot = null;
          break e;
        }
        if (s !== null) {
          s.return = u, Ot = s;
          break e;
        }
        Ot = u;
      }
    }
  }
  var RC = {
    getCacheForType: function(e) {
      var t = jt(vt), a = t.data.get(e);
      return a === void 0 && (a = e(), t.data.set(e, a)), a;
    },
    cacheSignal: function() {
      return jt(vt).controller.signal;
    }
  }, AC = typeof WeakMap == "function" ? WeakMap : Map, Ge = 0, et = null, Le = null, He = 0, Qe = 0, pn = null, mo = !1, Xl = !1, vd = !1, Ma = 0, mt = 0, ho = 0, ol = 0, ac = 0, gn = 0, Il = 0, ii = null, nn = null, pd = !1, oc = 0, lg = 0, lc = 1 / 0, rc = null, vo = null, ut = 0, qn = null, ll = null, ia = 0, gd = 0, yd = null, rg = null, Ql = null, Zl = null, Kl = null, si = 0, ic = null;
  function zn() {
    return (Ge & 2) !== 0 && He !== 0 ? He & -He : ve.T !== null ? Ad() : dv();
  }
  function ig() {
    if (gn === 0) if ((He & 536870912) === 0 || De) {
      var e = es;
      es <<= 1, (es & 3932160) === 0 && (es = 262144), gn = e;
    } else gn = 536870912;
    return e = Dt.current, e !== null && (e.flags |= 32), gn;
  }
  function Fl(e, t) {
    if (t != null) {
      var a = e.stateNode, l = a.ref;
      l === null && (l = a.ref = qg(xa(e.memoizedProps, a))), Zl === null && (Zl = []), Zl.push(t.bind(null, l));
    }
  }
  function an(e, t, a) {
    (e === et && (Qe === 2 || Qe === 9) || e.cancelPendingCommit !== null) && (Jl(e, 0), po(e, He, gn, !1)), as(e, a), ((Ge & 2) === 0 || e !== et) && (e === et && ((Ge & 2) === 0 && (ol |= a), mt === 4 && po(e, He, gn, !1)), za(e));
  }
  function sg(e, t, a) {
    if ((Ge & 6) !== 0) throw Error(c(327));
    var l = !a && (t & 127) === 0 && (t & e.expiredLanes) === 0 || Ar(e, t), s = l ? MC(e, t) : Sd(e, t, !0), u = l;
    do {
      if (s === 0) {
        Xl && !l && po(e, t, 0, !1);
        break;
      } else {
        if (a = e.current.alternate, u && !NC(a)) {
          s = Sd(e, t, !1), u = !1;
          continue;
        }
        if (s === 2) {
          if (u = t, e.errorRecoveryDisabledLanes & u) var p = 0;
          else p = e.pendingLanes & -536870913, p = p !== 0 ? p : p & 536870912 ? 536870912 : 0;
          if (p !== 0) {
            t = p;
            e: {
              var T = e;
              s = ii;
              var z = T.current.memoizedState.isDehydrated;
              if (z && (Jl(T, p).flags |= 256), p = Sd(T, p, !1), p !== 2 && p !== 6) {
                if (vd && !z) {
                  T.errorRecoveryDisabledLanes |= u, ol |= u, s = 4;
                  break e;
                }
                u = nn, nn = s, u !== null && (nn === null ? nn = u : nn.push.apply(nn, u));
              }
              s = p;
            }
            if (u = !1, s !== 2) continue;
          }
        }
        if (s === 1) {
          Jl(e, 0), po(e, t, 0, !0);
          break;
        }
        e: {
          switch (l = e, u = s, u) {
            case 0:
            case 1:
              throw Error(c(345));
            case 4:
              if ((t & 4194048) !== t && (t & 62914560) !== t) break;
            case 6:
              po(l, t, gn, !mo);
              break e;
            case 2:
              nn = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(c(329));
          }
          if ((t & 62914560) === t && (s = oc + 300 - Yt(), 10 < s)) {
            if (po(l, t, gn, !mo), ns(l, 0, !0) !== 0) break e;
            ia = t, l.timeoutHandle = kd(cg.bind(null, l, a, nn, rc, pd, t, gn, ol, Il, mo, u, "Throttled", -0, 0), s);
            break e;
          }
          cg(l, a, nn, rc, pd, t, gn, ol, Il, mo, u, null, -0, 0);
        }
      }
      break;
    } while (!0);
    za(e);
  }
  function cg(e, t, a, l, s, u, p, T, z, Y, F, le, U, K) {
    e.timeoutHandle = -1;
    var be = t.subtreeFlags, Ce = (u & 335544064) === u;
    if (le = null, (Ce || be & 8192 || (be & 16785408) === 16785408) && (le = {
      stylesheets: null,
      count: 0,
      imgCount: 0,
      imgBytes: 0,
      suspenseyImages: [],
      waitingForImages: !0,
      waitingForViewTransition: !1,
      unsuspend: Jn
    }, vn = null, tg(t, u, le), Ce && (be = le, Ce = e.containerInfo, Ce = (Ce.nodeType === 9 ? Ce : Ce.ownerDocument).__reactViewTransition, Ce != null && (be.count++, be.waitingForViewTransition = !0, be = pi.bind(be), Ce.finished.then(be, be))), be = (u & 62914560) === u ? oc - Yt() : (u & 4194048) === u ? lg - Yt() : 0, be = M2(le, be), be !== null)) {
      ia = u, e.cancelPendingCommit = be(gg.bind(null, e, t, u, a, l, s, p, T, z, Y, F, le, null, U, K)), po(e, u, p, !Y);
      return;
    }
    gg(e, t, u, a, l, s, p, T, z, Y, F, le);
  }
  function NC(e) {
    for (var t = e; ; ) {
      var a = t.tag;
      if ((a === 0 || a === 11 || a === 15) && t.flags & 16384 && (a = t.updateQueue, a !== null && (a = a.stores, a !== null))) for (var l = 0; l < a.length; l++) {
        var s = a[l], u = s.getSnapshot;
        s = s.value;
        try {
          if (!mn(u(), s)) return !1;
        } catch {
          return !1;
        }
      }
      if (a = t.child, t.subtreeFlags & 16384 && a !== null) a.return = t, t = a;
      else {
        if (t === e) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) return !0;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
    }
    return !0;
  }
  function po(e, t, a, l) {
    t = rv(e, t), t &= ~ac, t &= ~ol, e.suspendedLanes |= t, e.pingedLanes &= ~t, l && (e.warmLanes |= t), l = e.expirationTimes;
    for (var s = t; 0 < s; ) {
      var u = 31 - fn(s), p = 1 << u;
      l[u] = -1, s &= ~p;
    }
    a !== 0 && sv(e, a, t);
  }
  function sc() {
    return (Ge & 6) === 0 ? (ci(0, !1), !1) : !0;
  }
  function bd() {
    if (Le !== null) {
      if (Qe === 0) var e = Le.return;
      else e = Le, Ta = Go = null, Rf(e), kl = null, Xr = 0, e = Le;
      for (; e !== null; ) zp(e.alternate, e), e = e.return;
      Le = null;
    }
  }
  function Jl(e, t) {
    var a = e.timeoutHandle;
    return a !== -1 && (e.timeoutHandle = -1, FC(a)), a = e.cancelPendingCommit, a !== null && (e.cancelPendingCommit = null, a()), ia = 0, bd(), et = e, Le = a = Ca(e.current, null), He = t, Qe = 0, pn = null, mo = !1, Xl = Ar(e, t), vd = !1, Il = gn = ac = ol = ho = mt = 0, nn = ii = null, pd = !1, Ma = rv(e, t), ps(), a;
  }
  function ug(e, t) {
    ze = null, ve.H = Vs, t === Hl || t === Rs ? (t = S0(), Qe = 3) : t === hf ? (t = S0(), Qe = 4) : Qe = t === Yf ? 8 : t !== null && typeof t == "object" && typeof t.then == "function" ? 6 : 1, pn = t, Le === null && (mt = 1, Ys(e, Rn(t, e.current)));
  }
  function fg() {
    var e = Dt.current;
    return e === null ? !0 : (He & 4194048) === He ? $t === null : (He & 62914560) === He || (He & 536870912) !== 0 ? e === $t : !1;
  }
  function dg() {
    var e = ve.H;
    return ve.H = Vs, e === null ? Vs : e;
  }
  function mg() {
    var e = ve.A;
    return ve.A = RC, e;
  }
  function cc() {
    mt = 4, mo || (He & 4194048) !== He && Dt.current !== null || (Xl = !0), (ho & 134217727) === 0 && (ol & 134217727) === 0 || et === null || po(et, He, gn, !1);
  }
  function Sd(e, t, a) {
    var l = Ge;
    Ge |= 2;
    var s = dg(), u = mg();
    (et !== e || He !== t) && (rc = null, Jl(e, t)), t = !1;
    var p = mt;
    e: do
      try {
        if (Qe !== 0 && Le !== null) {
          var T = Le, z = pn;
          switch (Qe) {
            case 8:
              bd(), p = 6;
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              Dt.current === null && (t = !0);
              var Y = Qe;
              if (Qe = 0, pn = null, Wl(e, T, z, Y), a && Xl) {
                p = 0;
                break e;
              }
              break;
            default:
              Y = Qe, Qe = 0, pn = null, Wl(e, T, z, Y);
          }
        }
        OC(), p = mt;
        break;
      } catch (F) {
        ug(e, F);
      }
    while (!0);
    return t && e.shellSuspendCounter++, Ta = Go = null, Ge = l, ve.H = s, ve.A = u, Le === null && (et = null, He = 0, ps()), p;
  }
  function OC() {
    for (; Le !== null; ) hg(Le);
  }
  function MC(e, t) {
    var a = Ge;
    Ge |= 2;
    var l = dg(), s = mg();
    et !== e || He !== t ? (rc = null, lc = Yt() + 500, Jl(e, t)) : Xl = Ar(e, t);
    e: do
      try {
        if (Qe !== 0 && Le !== null) {
          t = Le;
          var u = pn;
          t: switch (Qe) {
            case 1:
              Qe = 0, pn = null, Wl(e, t, u, 1);
              break;
            case 2:
            case 9:
              if (y0(u)) {
                Qe = 0, pn = null, vg(t);
                break;
              }
              t = function() {
                Qe !== 2 && Qe !== 9 || et !== e || (Qe = 7), za(e);
              }, u.then(t, t);
              break e;
            case 3:
              Qe = 7;
              break e;
            case 4:
              Qe = 5;
              break e;
            case 7:
              y0(u) ? (Qe = 0, pn = null, vg(t)) : (Qe = 0, pn = null, Wl(e, t, u, 7));
              break;
            case 5:
              var p = null;
              switch (Le.tag) {
                case 26:
                  p = Le.memoizedState;
                case 5:
                case 27:
                  var T = Le;
                  if (p ? sy(p) : T.stateNode.complete) {
                    Qe = 0, pn = null;
                    var z = T.sibling;
                    if (z !== null) Le = z;
                    else {
                      var Y = T.return;
                      Y !== null ? (Le = Y, uc(Y)) : Le = null;
                    }
                    break t;
                  }
              }
              Qe = 0, pn = null, Wl(e, t, u, 5);
              break;
            case 6:
              Qe = 0, pn = null, Wl(e, t, u, 6);
              break;
            case 8:
              bd(), mt = 6;
              break e;
            default:
              throw Error(c(462));
          }
        }
        zC();
        break;
      } catch (F) {
        ug(e, F);
      }
    while (!0);
    return Ta = Go = null, ve.H = l, ve.A = s, Ge = a, Le !== null ? 0 : (et = null, He = 0, ps(), mt);
  }
  function zC() {
    for (; Le !== null && !Fi(); ) hg(Le);
  }
  function hg(e) {
    var t = Op(e.alternate, e, Ma);
    e.memoizedProps = e.pendingProps, t === null ? uc(e) : Le = t;
  }
  function vg(e) {
    var t = e, a = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = Cp(a, t, t.pendingProps, t.type, void 0, He);
        break;
      case 11:
        t = Cp(a, t, t.pendingProps, t.type.render, t.ref, He);
        break;
      case 5:
        Rf(t);
        var l = t;
        l === At && (De ? (ws(l), l.tag === 5 && l.stateNode != null && (nt = l.stateNode)) : (ws(l), De = !0));
      default:
        zp(a, t), t = Le = i0(t, Ma), t = Op(a, t, Ma);
    }
    e.memoizedProps = e.pendingProps, t === null ? uc(e) : Le = t;
  }
  function Wl(e, t, a, l) {
    Ta = Go = null, Rf(t), kl = null, Xr = 0;
    var s = t.return;
    try {
      if (bC(e, s, t, a, He)) {
        mt = 1, Ys(e, Rn(a, e.current)), Le = null;
        return;
      }
    } catch (u) {
      if (s !== null) throw Le = s, u;
      mt = 1, Ys(e, Rn(a, e.current)), Le = null;
      return;
    }
    t.flags & 32768 ? (De || l === 1 ? e = !0 : Xl || (He & 536870912) !== 0 ? e = !1 : (mo = e = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = Dt.current, l !== null && l.tag === 13 && (l.flags |= 16384))), pg(t, e)) : uc(t);
  }
  function uc(e) {
    var t = e;
    do {
      if ((t.flags & 32768) !== 0) {
        pg(t, mo);
        return;
      }
      e = t.return;
      var a = CC(t.alternate, t, Ma);
      if (a !== null) {
        Le = a;
        return;
      }
      if (t = t.sibling, t !== null) {
        Le = t;
        return;
      }
      Le = t = e;
    } while (t !== null);
    mt === 0 && (mt = 5);
  }
  function pg(e, t) {
    do {
      var a = EC(e.alternate, e);
      if (a !== null) {
        a.flags &= 32767, Le = a;
        return;
      }
      if (a = e.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !t && (e = e.sibling, e !== null)) {
        Le = e;
        return;
      }
      Le = e = a;
    } while (e !== null);
    mt = 6, Le = null;
  }
  function gg(e, t, a, l, s, u, p, T, z, Y, F, le) {
    e.cancelPendingCommit = null;
    do
      fc();
    while (ut !== 0);
    if ((Ge & 6) !== 0) throw Error(c(327));
    if (t !== null) {
      if (t === e.current) throw Error(c(177));
      e === et && (Le = et = null, He = 0), ll = t, qn = e, ia = a, yd = s, rg = l, jC(e, t, a, p, T, z, le);
    }
  }
  function jC(e, t, a, l, s, u, p) {
    var T = t.lanes | t.childLanes;
    if (gd = T, T |= ef, hw(e, a, T, l, s, u), Zl = null, (a & 335544064) === a ? (Kl = oC(e), l = 10262) : (Kl = null, l = 10256), (t.subtreeFlags & l) !== 0 || (t.flags & l) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, UC(Fa, function() {
      return Ed(), null;
    })) : (e.callbackNode = null, e.callbackPriority = 0), Ks = !1, l = (t.flags & 13878) !== 0, (t.subtreeFlags & 13878) !== 0 || l) {
      l = ve.T, ve.T = null, s = de.p, de.p = 2, u = Ge, Ge |= 4;
      try {
        TC(e, t, a);
      } finally {
        Ge = u, de.p = s, ve.T = l;
      }
    }
    ut = 1, Ks ? Ql = a2(p, e.containerInfo, Kl, xd, wd, LC, Cd, Ed, DC, null, null) : (xd(), wd(), Cd());
  }
  function DC(e) {
    if (ut !== 0) {
      var t = qn.onRecoverableError;
      t(e, { componentStack: null });
    }
  }
  function LC() {
    ut === 3 && (ut = 0, Wp(ll, qn), ut = 4);
  }
  function xd() {
    if (ut === 1) {
      ut = 0;
      var e = qn, t = ll, a = ia, l = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || l) {
        l = ve.T, ve.T = null;
        var s = de.p;
        de.p = 2;
        var u = Ge;
        Ge |= 4;
        try {
          oi = Ws = !1, Fp(t, e, a), a = Ld;
          var p = Fv(e.containerInfo), T = a.focusedElem, z = a.selectionRange;
          if (p !== T && T && T.ownerDocument && Kv(T.ownerDocument.documentElement, T)) {
            if (z !== null && Zu(T)) {
              var Y = z.start, F = z.end;
              if (F === void 0 && (F = Y), "selectionStart" in T) T.selectionStart = Y, T.selectionEnd = Math.min(F, T.value.length);
              else {
                var le = T.ownerDocument || document, U = le && le.defaultView || window;
                if (U.getSelection) {
                  var K = U.getSelection(), be = T.textContent.length, Ce = Math.min(z.start, be), je = z.end === void 0 ? Ce : Math.min(z.end, be);
                  !K.extend && Ce > je && (p = je, je = Ce, Ce = p);
                  var V = Zv(T, Ce), L = Zv(T, je);
                  if (V && L && (K.rangeCount !== 1 || K.anchorNode !== V.node || K.anchorOffset !== V.offset || K.focusNode !== L.node || K.focusOffset !== L.offset)) {
                    var P = le.createRange();
                    P.setStart(V.node, V.offset), K.removeAllRanges(), Ce > je ? (K.addRange(P), K.extend(L.node, L.offset)) : (P.setEnd(L.node, L.offset), K.addRange(P));
                  }
                }
              }
            }
            for (le = [], K = T; K = K.parentNode; ) K.nodeType === 1 && le.push({
              element: K,
              left: K.scrollLeft,
              top: K.scrollTop
            });
            for (typeof T.focus == "function" && T.focus(), T = 0; T < le.length; T++) {
              var oe = le[T];
              oe.element.scrollLeft = oe.left, oe.element.scrollTop = oe.top;
            }
          }
          ir = !!Dd, Ld = Dd = null;
        } finally {
          Ge = u, de.p = s, ve.T = l;
        }
      }
      e.current = t, ut = 2;
    }
  }
  function wd() {
    if (ut === 2) {
      ut = 0;
      var e = qn, t = ll, a = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || a) {
        a = ve.T, ve.T = null;
        var l = de.p;
        de.p = 2;
        var s = Ge;
        Ge |= 4;
        try {
          Pp(e, t.alternate, t);
        } finally {
          Ge = s, de.p = l, ve.T = a;
        }
      }
      ut = 3;
    }
  }
  function Cd() {
    if (ut === 4 || ut === 3) {
      ut = 0;
      var e = Ql;
      Ql = null, Ji();
      var t = qn, a = ll, l = ia, s = rg, u = (l & 335544064) === l ? 10262 : 10256;
      if ((a.subtreeFlags & u) !== 0 || (a.flags & u) !== 0 ? ut = 5 : (ut = 0, ll = qn = null, yg(t, t.pendingLanes)), u = t.pendingLanes, u === 0 && (vo = null), Mu(l), a = a.stateNode, un && typeof un.onCommitFiberRoot == "function") try {
        un.onCommitFiberRoot(Rr, a, void 0, (a.current.flags & 128) === 128);
      } catch {
      }
      if (s !== null) {
        a = ve.T, u = de.p, de.p = 2, ve.T = null;
        try {
          for (var p = t.onRecoverableError, T = 0; T < s.length; T++) {
            var z = s[T];
            p(z.value, { componentStack: z.stack });
          }
        } finally {
          ve.T = a, de.p = u;
        }
      }
      if (s = Zl, p = Kl, Kl = null, s !== null && (Zl = null, p === null && (p = []), e !== null)) for (z = 0; z < s.length; z++) a = (0, s[z])(p), a !== void 0 && e.finished.finally(a);
      (ia & 3) !== 0 && fc(), za(t), u = t.pendingLanes, (l & 261930) !== 0 && (u & 42) !== 0 ? t === ic ? si++ : (si = 0, ic = t) : (si = 0, ic = null), ci(0, !1);
    }
  }
  function yg(e, t) {
    (e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, qr(t)));
  }
  function fc() {
    return Ql !== null && (Ql.skipTransition(), Ql = null), xd(), wd(), Cd(), Ed();
  }
  function Ed() {
    if (ut !== 5) return !1;
    var e = qn, t = gd;
    gd = 0;
    var a = Mu(ia), l = ve.T, s = de.p;
    try {
      de.p = 32 > a ? 32 : a, ve.T = null, a = yd, yd = null;
      var u = qn, p = ia;
      if (ut = 0, ll = qn = null, ia = 0, (Ge & 6) !== 0) throw Error(c(331));
      var T = Ge;
      if (Ge |= 4, ag(u.current), eg(u, u.current, p, a), Ge = T, ci(0, !1), un && typeof un.onPostCommitFiberRoot == "function") try {
        un.onPostCommitFiberRoot(Rr, u);
      } catch {
      }
      return !0;
    } finally {
      de.p = s, ve.T = l, yg(e, t);
    }
  }
  function bg(e, t, a) {
    t = Rn(a, t), t = Vf(e.stateNode, t, 2), e = Wo(e, t, 2), e !== null && (as(e, 2), za(e));
  }
  function Ze(e, t, a) {
    if (e.tag === 3) bg(e, e, a);
    else for (; t !== null; ) {
      if (t.tag === 3) {
        bg(t, e, a);
        break;
      } else if (t.tag === 1) {
        var l = t.stateNode;
        if (typeof t.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (vo === null || !vo.has(l))) {
          e = Rn(a, e), a = vp(2), l = Wo(t, a, 2), l !== null && (pp(a, l, t, e), as(l, 2), za(l));
          break;
        }
      }
      t = t.return;
    }
  }
  function Td(e, t, a) {
    var l = e.pingCache;
    if (l === null) {
      l = e.pingCache = new AC();
      var s = /* @__PURE__ */ new Set();
      l.set(t, s);
    } else s = l.get(t), s === void 0 && (s = /* @__PURE__ */ new Set(), l.set(t, s));
    s.has(a) || (vd = !0, s.add(a), e = BC.bind(null, e, t, a), t.then(e, e));
  }
  function BC(e, t, a) {
    var l = e.pingCache;
    l !== null && l.delete(t), e.pingedLanes |= e.suspendedLanes & a, e.warmLanes &= ~a, et === e && (He & a) === a && ((mt === 4 || mt === 3 && (He & 62914560) === He && 300 > Yt() - oc) && (Ge & 2) === 0 ? Jl(e, 0) : ac |= a, Il === He && (Il = 0)), za(e);
  }
  function Sg(e, t) {
    t === 0 && (t = iv()), e = Vo(e, t), e !== null && (as(e, t), za(e));
  }
  function HC(e) {
    var t = e.memoizedState, a = 0;
    t !== null && (a = t.retryLane), Sg(e, a);
  }
  function kC(e, t) {
    var a = 0;
    switch (e.tag) {
      case 31:
      case 13:
        var l = e.stateNode, s = e.memoizedState;
        s !== null && (a = s.retryLane);
        break;
      case 19:
        l = e.stateNode;
        break;
      case 22:
        l = e.stateNode._retryCache;
        break;
      default:
        throw Error(c(314));
    }
    l !== null && l.delete(t), Sg(e, a);
  }
  function UC(e, t) {
    return _t(e, t);
  }
  var er = null, tr = null, _d = !1, dc = !1, Rd = !1, go = 0;
  function za(e) {
    e !== tr && e.next === null && (tr === null ? er = tr = e : tr = tr.next = e), dc = !0, _d || (_d = !0, VC());
  }
  function ci(e, t) {
    if (!Rd && dc) {
      Rd = !0;
      do
        for (var a = !1, l = er; l !== null; ) {
          if (!t) if (e !== 0) {
            var s = l.pendingLanes;
            if (s === 0) var u = 0;
            else {
              var p = l.suspendedLanes, T = l.pingedLanes;
              u = (1 << 31 - fn(42 | e) + 1) - 1, u &= s & ~(p & ~T), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
            }
            u !== 0 && (a = !0, Eg(l, u));
          } else u = He, u = ns(l, l === et ? u : 0, l.cancelPendingCommit !== null || l.timeoutHandle !== -1), (u & 3) === 0 || Ar(l, u) || (a = !0, Eg(l, u));
          l = l.next;
        }
      while (a);
      Rd = !1;
    }
  }
  function $C() {
    xg();
  }
  function xg() {
    dc = _d = !1;
    var e = 0;
    go !== 0 && KC() && (e = go);
    for (var t = Yt(), a = null, l = er; l !== null; ) {
      var s = l.next, u = wg(l, t);
      u === 0 ? (l.next = null, a === null ? er = s : a.next = s, s === null && (tr = a)) : (a = l, (e !== 0 || (u & 3) !== 0) && (dc = !0)), l = s;
    }
    ut !== 0 && ut !== 5 || ci(e, !1), go !== 0 && (go = 0);
  }
  function wg(e, t) {
    for (var a = e.suspendedLanes, l = e.pingedLanes, s = e.expirationTimes, u = e.pendingLanes & -62914561; 0 < u; ) {
      var p = 31 - fn(u), T = 1 << p, z = s[p];
      z === -1 ? ((T & a) === 0 || (T & l) !== 0) && (s[p] = mw(T, t)) : z <= t && (e.expiredLanes |= T), u &= ~T;
    }
    if (t = et, a = He, a = ns(e, e === t ? a : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), l = e.callbackNode, a === 0 || e === t && (Qe === 2 || Qe === 9) || e.cancelPendingCommit !== null) return l !== null && l !== null && En(l), e.callbackNode = null, e.callbackPriority = 0;
    if ((a & 3) === 0 || Ar(e, a)) {
      if (t = a & -a, t === e.callbackPriority) return t;
      switch (l !== null && En(l), Mu(a)) {
        case 2:
        case 8:
          a = Ut;
          break;
        case 32:
          a = Fa;
          break;
        case 268435456:
          a = lv;
          break;
        default:
          a = Fa;
      }
      return l = Cg.bind(null, e), a = _t(a, l), e.callbackPriority = t, e.callbackNode = a, t;
    }
    return l !== null && l !== null && En(l), e.callbackPriority = 2, e.callbackNode = null, 2;
  }
  function Cg(e, t) {
    if (ut !== 0 && ut !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
    var a = e.callbackNode;
    if (fc() && e.callbackNode !== a) return null;
    var l = He;
    return l = ns(e, e === et ? l : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), l === 0 ? null : (sg(e, l, t), wg(e, Yt()), e.callbackNode != null && e.callbackNode === a ? Cg.bind(null, e) : null);
  }
  function Eg(e, t) {
    if (fc()) return null;
    sg(e, t, !0);
  }
  function VC() {
    JC(function() {
      (Ge & 6) !== 0 ? _t(wt, $C) : xg();
    });
  }
  function Ad() {
    if (go === 0) {
      var e = Io;
      e === 0 && (e = Wi, Wi <<= 1, (Wi & 261888) === 0 && (Wi = 256)), go = e;
    }
    return go;
  }
  function Tg(e) {
    return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : ss(e);
  }
  function YC(e, t, a, l, s) {
    if (t === "submit" && a && a.stateNode === s) {
      var u = Tg((s[Jt] || null).action), p = l.submitter;
      p && (t = (t = p[Jt] || null) ? Tg(t.formAction) : p.getAttribute("formAction"), t !== null && (u = t, p = null));
      var T = new ds("action", "action", null, l, s);
      e.push({
        event: T,
        listeners: [{
          instance: null,
          listener: function() {
            if (l.defaultPrevented) {
              if (go !== 0) {
                var z = new FormData(s, p);
                Bf(a, {
                  pending: !0,
                  data: z,
                  method: s.method,
                  action: u
                }, null, z);
              }
            } else typeof u == "function" && (T.preventDefault(), z = new FormData(s, p), Bf(a, {
              pending: !0,
              data: z,
              method: s.method,
              action: u
            }, u, z));
          },
          currentTarget: s
        }]
      });
    }
  }
  for (var Nd = 0; Nd < Wu.length; Nd++) {
    var Od = Wu[Nd];
    Un(Od.toLowerCase(), "on" + (Od[0].toUpperCase() + Od.slice(1)));
  }
  Un(e0, "onAnimationEnd"), Un(t0, "onAnimationIteration"), Un(n0, "onAnimationStart"), Un("dblclick", "onDoubleClick"), Un("focusin", "onFocus"), Un("focusout", "onBlur"), Un(Kw, "onTransitionRun"), Un(Fw, "onTransitionStart"), Un(Jw, "onTransitionCancel"), Un(a0, "onTransitionEnd"), Cl("onMouseEnter", ["mouseout", "mouseover"]), Cl("onMouseLeave", ["mouseout", "mouseover"]), Cl("onPointerEnter", ["pointerout", "pointerover"]), Cl("onPointerLeave", ["pointerout", "pointerover"]), ko("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), ko("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), ko("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), ko("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), ko("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), ko("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
  var ui = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), qC = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(ui));
  function _g(e, t) {
    t = (t & 4) !== 0;
    for (var a = 0; a < e.length; a++) {
      var l = e[a], s = l.event;
      l = l.listeners;
      e: {
        var u = void 0;
        if (t) for (var p = l.length - 1; 0 <= p; p--) {
          var T = l[p], z = T.instance, Y = T.currentTarget;
          if (T = T.listener, z !== u && s.isPropagationStopped()) break e;
          u = T, s.currentTarget = Y;
          try {
            u(s);
          } catch (F) {
            vs(F);
          }
          s.currentTarget = null, u = z;
        }
        else for (p = 0; p < l.length; p++) {
          if (T = l[p], z = T.instance, Y = T.currentTarget, T = T.listener, z !== u && s.isPropagationStopped()) break e;
          u = T, s.currentTarget = Y;
          try {
            u(s);
          } catch (F) {
            vs(F);
          }
          s.currentTarget = null, u = z;
        }
      }
    }
  }
  function Be(e, t) {
    var a = t[hv];
    a === void 0 && (a = t[hv] = /* @__PURE__ */ new Set());
    var l = e + "__bubble";
    a.has(l) || (Ag(t, e, 2, !1), a.add(l));
  }
  function Md(e, t, a) {
    var l = 0;
    t && (l |= 4), Ag(a, e, l, t);
  }
  var mc = "_reactListening" + Math.random().toString(36).slice(2);
  function Rg(e) {
    if (!e[mc]) {
      e[mc] = !0, gv.forEach(function(a) {
        a !== "selectionchange" && (qC.has(a) || Md(a, !1, e), Md(a, !0, e));
      });
      var t = e.nodeType === 9 ? e : e.ownerDocument;
      t === null || t[mc] || (t[mc] = !0, Md("selectionchange", !1, t));
    }
  }
  function Ag(e, t, a, l) {
    switch (py(t)) {
      case 2:
        var s = H2;
        break;
      case 8:
        s = k2;
        break;
      default:
        s = Fd;
    }
    a = s.bind(null, t, a, e), s = void 0, !Uu || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (s = !0), l ? s !== void 0 ? e.addEventListener(t, a, {
      capture: !0,
      passive: s
    }) : e.addEventListener(t, a, !0) : s !== void 0 ? e.addEventListener(t, a, { passive: s }) : e.addEventListener(t, a, !1);
  }
  function zd(e, t, a, l, s) {
    var u = l;
    if ((t & 1) === 0 && (t & 2) === 0 && l !== null) e: for (; ; ) {
      if (l === null) return;
      var p = l.tag;
      if (p === 3 || p === 4) {
        var T = l.stateNode.containerInfo;
        if (T === s) break;
        if (p === 4) for (p = l.return; p !== null; ) {
          var z = p.tag;
          if ((z === 3 || z === 4) && p.stateNode.containerInfo === s) return;
          p = p.return;
        }
        for (; T !== null; ) {
          if (p = Ho(T), p === null) return;
          if (z = p.tag, z === 5 || z === 6 || z === 26 || z === 27) {
            l = u = p;
            continue e;
          }
          T = T.parentNode;
        }
      }
      l = l.return;
    }
    Ov(function() {
      var Y = u, F = Hu(a), le = [];
      e: {
        var U = o0.get(e);
        if (U !== void 0) {
          var K = ds, be = e;
          switch (e) {
            case "keypress":
              if (us(a) === 0) break e;
            case "keydown":
            case "keyup":
              K = zw;
              break;
            case "focusin":
              be = "focus", K = qu;
              break;
            case "focusout":
              be = "blur", K = qu;
              break;
            case "beforeblur":
            case "afterblur":
              K = qu;
              break;
            case "click":
              if (a.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              K = jv;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              K = Tw;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              K = Dw;
              break;
            case e0:
            case t0:
            case n0:
              K = _w;
              break;
            case a0:
              K = Lw;
              break;
            case "scroll":
            case "scrollend":
              K = Ew;
              break;
            case "wheel":
              K = Bw;
              break;
            case "copy":
            case "cut":
            case "paste":
              K = Rw;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              K = Lv;
              break;
            case "submit":
              K = jw;
              break;
            case "toggle":
            case "beforetoggle":
              K = Hw;
          }
          var Ce = (t & 4) !== 0, je = !Ce && (e === "scroll" || e === "scrollend"), V = Ce ? U !== null ? U + "Capture" : null : U;
          Ce = [];
          for (var L = Y, P; L !== null; ) {
            var oe = L;
            if (P = oe.stateNode, oe = oe.tag, oe !== 5 && oe !== 26 && oe !== 27 || P === null || V === null || (oe = zr(L, V), oe != null && Ce.push(fi(L, oe, P))), je) break;
            L = L.return;
          }
          0 < Ce.length && (U = new K(U, be, null, a, F), le.push({
            event: U,
            listeners: Ce
          }));
        }
      }
      if ((t & 7) === 0) {
        e: {
          if (K = e === "mouseover" || e === "pointerover", U = e === "mouseout" || e === "pointerout", K && a !== Bu && (be = a.relatedTarget || a.fromElement) && (Ho(be) || be[Nr])) break e;
          (U || K) && (be = F.window === F ? F : (K = F.ownerDocument) ? K.defaultView || K.parentWindow : window, U ? (K = a.relatedTarget || a.toElement, U = Y, K = K ? Ho(K) : null, K !== null && (je = d(K), Ce = K.tag, K !== je || Ce !== 5 && Ce !== 27 && Ce !== 6) && (K = null)) : (U = null, K = Y), U !== K && (Ce = jv, oe = "onMouseLeave", V = "onMouseEnter", L = "mouse", (e === "pointerout" || e === "pointerover") && (Ce = Lv, oe = "onPointerLeave", V = "onPointerEnter", L = "pointer"), je = U == null ? be : Mr(U), P = K == null ? be : Mr(K), be = new Ce(oe, L + "leave", U, a, F), be.target = je, be.relatedTarget = P, oe = null, Ho(F) === Y && (Ce = new Ce(V, L + "enter", K, a, F), Ce.target = P, Ce.relatedTarget = je, oe = Ce), je = oe, Ce = U && K ? $(U, K, GC) : null, U !== null && Ng(le, be, U, Ce, !1), K !== null && je !== null && Ng(le, je, K, Ce, !0)));
        }
        e: {
          if (U = Y ? Mr(Y) : window, K = U.nodeName && U.nodeName.toLowerCase(), K === "select" || K === "input" && U.type === "file") var we = qv;
          else if (Vv(U)) if (Gv) we = Iw;
          else {
            we = Pw;
            var ke = Gw;
          }
          else K = U.nodeName, !K || K.toLowerCase() !== "input" || U.type !== "checkbox" && U.type !== "radio" ? Y && Lu(Y.elementType) && (we = qv) : we = Xw;
          if (we && (we = we(e, Y))) {
            Yv(le, we, a, F);
            break e;
          }
          ke && ke(e, U, Y);
        }
        switch (ke = Y ? Mr(Y) : window, e) {
          case "focusin":
            (Vv(ke) || ke.contentEditable === "true") && (Nl = ke, Ku = Y, $r = null);
            break;
          case "focusout":
            $r = Ku = Nl = null;
            break;
          case "mousedown":
            Fu = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            Fu = !1, Jv(le, a, F);
            break;
          case "selectionchange":
            if (Zw) break;
          case "keydown":
          case "keyup":
            Jv(le, a, F);
        }
        var Te;
        if (Pu) e: {
          switch (e) {
            case "compositionstart":
              var Re = "onCompositionStart";
              break e;
            case "compositionend":
              Re = "onCompositionEnd";
              break e;
            case "compositionupdate":
              Re = "onCompositionUpdate";
              break e;
          }
          Re = void 0;
        }
        else Al ? Uv(e, a) && (Re = "onCompositionEnd") : e === "keydown" && a.keyCode === 229 && (Re = "onCompositionStart");
        Re && (Bv && a.locale !== "ko" && (Al || Re !== "onCompositionStart" ? Re === "onCompositionEnd" && Al && (Te = Mv()) : (Wa = F, $u = "value" in Wa ? Wa.value : Wa.textContent, Al = !0)), ke = hc(Y, Re), 0 < ke.length && (Re = new Dv(Re, e, null, a, F), le.push({
          event: Re,
          listeners: ke
        }), Te ? Re.data = Te : (Te = $v(a), Te !== null && (Re.data = Te)))), (Te = Uw ? $w(e, a) : Vw(e, a)) && (Re = hc(Y, "onBeforeInput"), 0 < Re.length && (ke = new Dv("onBeforeInput", "beforeinput", null, a, F), le.push({
          event: ke,
          listeners: Re
        }), ke.data = Te)), YC(le, e, Y, a, F);
      }
      _g(le, t);
    });
  }
  function fi(e, t, a) {
    return {
      instance: e,
      listener: t,
      currentTarget: a
    };
  }
  function hc(e, t) {
    for (var a = t + "Capture", l = []; e !== null; ) {
      var s = e, u = s.stateNode;
      if (s = s.tag, s !== 5 && s !== 26 && s !== 27 || u === null || (s = zr(e, a), s != null && l.unshift(fi(e, s, u)), s = zr(e, t), s != null && l.push(fi(e, s, u))), e.tag === 3) return l;
      e = e.return;
    }
    return [];
  }
  function GC(e) {
    if (e === null) return null;
    do
      e = e.return;
    while (e && e.tag !== 5 && e.tag !== 27);
    return e || null;
  }
  function Ng(e, t, a, l, s) {
    for (var u = t._reactName, p = []; a !== null && a !== l; ) {
      var T = a, z = T.alternate, Y = T.stateNode;
      if (T = T.tag, z !== null && z === l) break;
      T !== 5 && T !== 26 && T !== 27 || Y === null || (z = Y, s ? (Y = zr(a, u), Y != null && p.unshift(fi(a, Y, z))) : s || (Y = zr(a, u), Y != null && p.push(fi(a, Y, z)))), a = a.return;
    }
    p.length !== 0 && e.push({
      event: t,
      listeners: p
    });
  }
  var PC = /\r\n?/g, XC = /\u0000|\uFFFD/g;
  function Og(e) {
    return (typeof e == "string" ? e : "" + e).replace(PC, `
`).replace(XC, "");
  }
  function Mg(e, t) {
    return t = Og(t), Og(e) === t;
  }
  function Ke(e, t, a, l, s, u) {
    switch (a) {
      case "children":
        if (typeof l == "string") t === "body" || t === "textarea" && l === "" || Tl(e, l);
        else if (typeof l == "number" || typeof l == "bigint") t !== "body" && Tl(e, "" + l);
        else return;
        break;
      case "className":
        is(e, "class", l);
        break;
      case "tabIndex":
        is(e, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        is(e, a, l);
        break;
      case "style":
        Av(e, l, u);
        return;
      case "data":
        if (t !== "object") {
          is(e, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (t !== "a" || a !== "href")) {
          e.removeAttribute(a);
          break;
        }
        if (l == null || typeof l == "function" || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(a);
          break;
        }
        l = ss(l), e.setAttribute(a, l);
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          e.setAttribute(a, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
          break;
        } else typeof u == "function" && (a === "formAction" ? (t !== "input" && Ke(e, t, "name", s.name, s, null), Ke(e, t, "formEncType", s.formEncType, s, null), Ke(e, t, "formMethod", s.formMethod, s, null), Ke(e, t, "formTarget", s.formTarget, s, null)) : (Ke(e, t, "encType", s.encType, s, null), Ke(e, t, "method", s.method, s, null), Ke(e, t, "target", s.target, s, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(a);
          break;
        }
        l = ss(l), e.setAttribute(a, l);
        break;
      case "onClick":
        l != null && (e.onclick = Jn);
        return;
      case "onScroll":
        l != null && Be("scroll", e);
        return;
      case "onScrollEnd":
        l != null && Be("scrollend", e);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(c(61));
          if (a = l.__html, a != null) {
            if (s.children != null) throw Error(c(60));
            u?.__html !== a && (e.innerHTML = a);
          }
        }
        break;
      case "multiple":
        e.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        e.muted = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (l == null || typeof l == "function" || typeof l == "boolean" || typeof l == "symbol") {
          e.removeAttribute("xlink:href");
          break;
        }
        a = ss(l), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", a);
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        l != null && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(a, l) : e.removeAttribute(a);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "credentialless":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        l && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(a, "") : e.removeAttribute(a);
        break;
      case "capture":
      case "download":
        l === !0 ? e.setAttribute(a, "") : l !== !1 && l != null && typeof l != "function" && typeof l != "symbol" ? e.setAttribute(a, l) : e.removeAttribute(a);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null && typeof l != "function" && typeof l != "symbol" && !isNaN(l) && 1 <= l ? e.setAttribute(a, l) : e.removeAttribute(a);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l) ? e.removeAttribute(a) : e.setAttribute(a, l);
        break;
      case "popover":
        Be("beforetoggle", e), Be("toggle", e), rs(e, "popover", l);
        break;
      case "xlinkActuate":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:actuate", l);
        break;
      case "xlinkArcrole":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", l);
        break;
      case "xlinkRole":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:role", l);
        break;
      case "xlinkShow":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:show", l);
        break;
      case "xlinkTitle":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:title", l);
        break;
      case "xlinkType":
        ba(e, "http://www.w3.org/1999/xlink", "xlink:type", l);
        break;
      case "xmlBase":
        ba(e, "http://www.w3.org/XML/1998/namespace", "xml:base", l);
        break;
      case "xmlLang":
        ba(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", l);
        break;
      case "xmlSpace":
        ba(e, "http://www.w3.org/XML/1998/namespace", "xml:space", l);
        break;
      case "is":
        rs(e, "is", l);
        break;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!(2 < a.length) || a[0] !== "o" && a[0] !== "O" || a[1] !== "n" && a[1] !== "N") a = ww.get(a) || a, rs(e, a, l);
        else return;
    }
    Ve = !0;
  }
  function jd(e, t, a, l, s, u) {
    switch (a) {
      case "style":
        Av(e, l, u);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(c(61));
          if (a = l.__html, a != null) {
            if (s.children != null) throw Error(c(60));
            u?.__html !== a && (e.innerHTML = a);
          }
        }
        break;
      case "children":
        if (typeof l == "string") Tl(e, l);
        else if (typeof l == "number" || typeof l == "bigint") Tl(e, "" + l);
        else return;
        break;
      case "onScroll":
        l != null && Be("scroll", e);
        return;
      case "onScrollEnd":
        l != null && Be("scrollend", e);
        return;
      case "onClick":
        l != null && (e.onclick = Jn);
        return;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        return;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!yv.hasOwnProperty(a)) e: {
          if (a[0] === "o" && a[1] === "n" && (s = a.endsWith("Capture"), u = a.slice(2, s ? a.length - 7 : void 0), t = e[Jt] || null, t = t != null ? t[a] : null, typeof t == "function" && e.removeEventListener(u, t, s), typeof l == "function")) {
            typeof t != "function" && t !== null && (a in e ? e[a] = null : e.hasAttribute(a) && e.removeAttribute(a)), e.addEventListener(u, l, s);
            break e;
          }
          Ve = !0, a in e ? e[a] = l : l === !0 ? e.setAttribute(a, "") : rs(e, a, l);
        }
        return;
    }
    Ve = !0;
  }
  function Ht(e, t, a) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        Be("error", e), Be("load", e);
        var l = !1, s = !1, u;
        for (u in a) if (a.hasOwnProperty(u)) {
          var p = a[u];
          if (p != null) switch (u) {
            case "src":
              l = !0;
              break;
            case "srcSet":
              s = !0;
              break;
            case "children":
            case "dangerouslySetInnerHTML":
              throw Error(c(137, t));
            default:
              Ke(e, t, u, p, a, null);
          }
        }
        s && Ke(e, t, "srcSet", a.srcSet, a, null), l && Ke(e, t, "src", a.src, a, null);
        return;
      case "input":
        Be("invalid", e);
        var T = u = p = s = null, z = null, Y = null;
        for (l in a) if (a.hasOwnProperty(l)) {
          var F = a[l];
          if (F != null) switch (l) {
            case "name":
              s = F;
              break;
            case "type":
              p = F;
              break;
            case "checked":
              z = F;
              break;
            case "defaultChecked":
              Y = F;
              break;
            case "value":
              u = F;
              break;
            case "defaultValue":
              T = F;
              break;
            case "children":
            case "dangerouslySetInnerHTML":
              if (F != null) throw Error(c(137, t));
              break;
            default:
              Ke(e, t, l, F, a, null);
          }
        }
        Ev(e, u, T, z, Y, p, s, !1);
        return;
      case "select":
        Be("invalid", e), l = p = u = null;
        for (s in a) if (a.hasOwnProperty(s) && (T = a[s], T != null)) switch (s) {
          case "value":
            u = T;
            break;
          case "defaultValue":
            p = T;
            break;
          case "multiple":
            l = T;
          default:
            Ke(e, t, s, T, a, null);
        }
        t = u, a = p, e.multiple = !!l, t != null ? El(e, !!l, t, !1) : a != null && El(e, !!l, a, !0);
        return;
      case "textarea":
        Be("invalid", e), u = s = l = null;
        for (p in a) if (a.hasOwnProperty(p) && (T = a[p], T != null)) switch (p) {
          case "value":
            l = T;
            break;
          case "defaultValue":
            s = T;
            break;
          case "children":
            u = T;
            break;
          case "dangerouslySetInnerHTML":
            if (T != null) throw Error(c(91));
            break;
          default:
            Ke(e, t, p, T, a, null);
        }
        _v(e, l, s, u);
        return;
      case "option":
        for (z in a) a.hasOwnProperty(z) && (l = a[z], l != null) && (z === "selected" ? e.selected = l && typeof l != "function" && typeof l != "symbol" : Ke(e, t, z, l, a, null));
        return;
      case "dialog":
        Be("beforetoggle", e), Be("toggle", e), Be("cancel", e), Be("close", e);
        break;
      case "iframe":
      case "object":
        Be("load", e);
        break;
      case "video":
      case "audio":
        for (l = 0; l < ui.length; l++) Be(ui[l], e);
        break;
      case "image":
        Be("error", e), Be("load", e);
        break;
      case "details":
        Be("toggle", e);
        break;
      case "embed":
      case "source":
      case "link":
        Be("error", e), Be("load", e);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (Y in a) if (a.hasOwnProperty(Y) && (l = a[Y], l != null)) switch (Y) {
          case "children":
          case "dangerouslySetInnerHTML":
            throw Error(c(137, t));
          default:
            Ke(e, t, Y, l, a, null);
        }
        return;
      default:
        if (Lu(t)) {
          for (F in a) a.hasOwnProperty(F) && (l = a[F], l !== void 0 && jd(e, t, F, l, a, void 0));
          return;
        }
    }
    for (T in a) a.hasOwnProperty(T) && (l = a[T], l != null && Ke(e, t, T, l, a, null));
  }
  var IC = {};
  function QC(e, t, a, l) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var s = null, u = null, p = null, T = null, z = null, Y = null, F = null;
        for (K in a) {
          var le = a[K];
          if (a.hasOwnProperty(K) && le != null) switch (K) {
            case "checked":
              break;
            case "value":
              break;
            case "defaultValue":
              z = le;
            default:
              l.hasOwnProperty(K) || Ke(e, t, K, null, l, le);
          }
        }
        for (var U in l) {
          var K = l[U];
          if (le = a[U], l.hasOwnProperty(U) && (K != null || le != null)) switch (U) {
            case "type":
              K !== le && (Ve = !0), u = K;
              break;
            case "name":
              K !== le && (Ve = !0), s = K;
              break;
            case "checked":
              K !== le && (Ve = !0), Y = K;
              break;
            case "defaultChecked":
              K !== le && (Ve = !0), F = K;
              break;
            case "value":
              K !== le && (Ve = !0), p = K;
              break;
            case "defaultValue":
              K !== le && (Ve = !0), T = K;
              break;
            case "children":
            case "dangerouslySetInnerHTML":
              if (K != null) throw Error(c(137, t));
              break;
            default:
              K !== le && Ke(e, t, U, K, l, le);
          }
        }
        ju(e, p, T, z, Y, F, u, s);
        return;
      case "select":
        K = p = T = U = null;
        for (u in a) if (z = a[u], a.hasOwnProperty(u) && z != null) switch (u) {
          case "value":
            break;
          case "multiple":
            K = z;
          default:
            l.hasOwnProperty(u) || Ke(e, t, u, null, l, z);
        }
        for (s in l) if (u = l[s], z = a[s], l.hasOwnProperty(s) && (u != null || z != null)) switch (s) {
          case "value":
            u !== z && (Ve = !0), U = u;
            break;
          case "defaultValue":
            u !== z && (Ve = !0), T = u;
            break;
          case "multiple":
            u !== z && (Ve = !0), p = u;
          default:
            u !== z && Ke(e, t, s, u, l, z);
        }
        t = T, a = p, l = K, U != null ? El(e, !!a, U, !1) : !!l != !!a && (t != null ? El(e, !!a, t, !0) : El(e, !!a, a ? [] : "", !1));
        return;
      case "textarea":
        K = U = null;
        for (T in a) if (s = a[T], a.hasOwnProperty(T) && s != null && !l.hasOwnProperty(T)) switch (T) {
          case "value":
            break;
          case "children":
            break;
          default:
            Ke(e, t, T, null, l, s);
        }
        for (p in l) if (s = l[p], u = a[p], l.hasOwnProperty(p) && (s != null || u != null)) switch (p) {
          case "value":
            s !== u && (Ve = !0), U = s;
            break;
          case "defaultValue":
            s !== u && (Ve = !0), K = s;
            break;
          case "children":
            break;
          case "dangerouslySetInnerHTML":
            if (s != null) throw Error(c(91));
            break;
          default:
            s !== u && Ke(e, t, p, s, l, u);
        }
        Tv(e, U, K);
        return;
      case "option":
        for (var be in a) U = a[be], a.hasOwnProperty(be) && U != null && !l.hasOwnProperty(be) && (be === "selected" ? e.selected = !1 : Ke(e, t, be, null, l, U));
        for (z in l) U = l[z], K = a[z], l.hasOwnProperty(z) && U !== K && (U != null || K != null) && (z === "selected" ? (U !== K && (Ve = !0), e.selected = U && typeof U != "function" && typeof U != "symbol") : Ke(e, t, z, U, l, K));
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var Ce in a) U = a[Ce], a.hasOwnProperty(Ce) && U != null && !l.hasOwnProperty(Ce) && Ke(e, t, Ce, null, l, U);
        for (Y in l) if (U = l[Y], K = a[Y], l.hasOwnProperty(Y) && U !== K && (U != null || K != null)) switch (Y) {
          case "children":
          case "dangerouslySetInnerHTML":
            if (U != null) throw Error(c(137, t));
            break;
          default:
            Ke(e, t, Y, U, l, K);
        }
        return;
      default:
        if (Lu(t)) {
          for (var je in a) U = a[je], a.hasOwnProperty(je) && U !== void 0 && !l.hasOwnProperty(je) && jd(e, t, je, void 0, l, U);
          for (F in l) U = l[F], K = a[F], !l.hasOwnProperty(F) || U === K || U === void 0 && K === void 0 || jd(e, t, F, U, l, K);
          return;
        }
    }
    for (var V in a) U = a[V], a.hasOwnProperty(V) && U != null && !l.hasOwnProperty(V) && Ke(e, t, V, null, l, U);
    for (le in l) U = l[le], K = a[le], !l.hasOwnProperty(le) || U === K || U == null && K == null || Ke(e, t, le, U, l, K);
  }
  function zg(e) {
    switch (e) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function ZC() {
    if (typeof performance.getEntriesByType == "function") {
      for (var e = 0, t = 0, a = performance.getEntriesByType("resource"), l = 0; l < a.length; l++) {
        var s = a[l], u = s.transferSize, p = s.initiatorType, T = s.duration;
        if (u && T && zg(p)) {
          for (p = 0, T = s.responseEnd, l += 1; l < a.length; l++) {
            var z = a[l], Y = z.startTime;
            if (Y > T) break;
            var F = z.transferSize, le = z.initiatorType;
            F && zg(le) && (z = z.responseEnd, p += F * (z < T ? 1 : (T - Y) / (z - Y)));
          }
          if (--l, t += 8 * (u + p) / (s.duration / 1e3), e++, 10 < e) break;
        }
      }
      if (0 < e) return t / e / 1e6;
    }
    return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
  }
  var Dd = null, Ld = null;
  function di(e) {
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  function jg(e) {
    switch (e) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function Dg(e, t) {
    if (e === 0) switch (t) {
      case "svg":
        return 1;
      case "math":
        return 2;
      default:
        return 0;
    }
    return e === 1 && t === "foreignObject" ? 0 : e;
  }
  function Lg(e, t, a, l) {
    return a = di(a).createElement(e), a[zt] = l, a[Jt] = t, Ht(a, e, t), Rt(a), a;
  }
  function Bd(e, t) {
    return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
  }
  var Hd = null;
  function KC() {
    var e = window.event;
    return e && e.type === "popstate" ? e === Hd ? !1 : (Hd = e, !0) : (Hd = null, !1);
  }
  var kd = typeof setTimeout == "function" ? setTimeout : void 0, FC = typeof clearTimeout == "function" ? clearTimeout : void 0, Bg = typeof Promise == "function" ? Promise : void 0, Hg = typeof requestAnimationFrame == "function" ? requestAnimationFrame : kd, JC = typeof queueMicrotask == "function" ? queueMicrotask : typeof Bg < "u" ? function(e) {
    return Bg.resolve(null).then(e).catch(WC);
  } : kd;
  function WC(e) {
    setTimeout(function() {
      throw e;
    });
  }
  function yo(e) {
    return e === "head";
  }
  function kg(e, t) {
    var a = t, l = 0;
    do {
      var s = a.nextSibling;
      if (e.removeChild(a), s && s.nodeType === 8) if (a = s.data, a === "/$" || a === "/&") {
        if (l === 0) {
          e.removeChild(s), sr(t);
          return;
        }
        l--;
      } else if (a === "$" || a === "$?" || a === "$~" || a === "$!" || a === "&") l++;
      else if (a === "html") Xd(e.ownerDocument.documentElement);
      else if (a === "head") {
        a = e.ownerDocument.head, Xd(a);
        for (var u = a.firstChild; u; ) {
          var p = u.nextSibling, T = u.nodeName;
          u[Or] || T === "SCRIPT" || T === "STYLE" || T === "LINK" && u.rel.toLowerCase() === "stylesheet" || a.removeChild(u), u = p;
        }
      } else a === "body" && Xd(e.ownerDocument.body);
      a = s;
    } while (a);
    sr(t);
  }
  function Ug(e, t) {
    var a = e;
    e = 0;
    do {
      var l = a.nextSibling;
      if (a.nodeType === 1 ? t ? (a._stashedDisplay = a.style.display, a.style.display = "none") : (a.style.display = a._stashedDisplay || "", a.getAttribute("style") === "" && a.removeAttribute("style")) : a.nodeType === 3 && (t ? (a._stashedText = a.nodeValue, a.nodeValue = "") : a.nodeValue = a._stashedText || ""), l && l.nodeType === 8) if (a = l.data, a === "/$") {
        if (e === 0) break;
        e--;
      } else a !== "$" && a !== "$?" && a !== "$~" && a !== "$!" || e++;
      a = l;
    } while (a);
  }
  function $g(e, t, a) {
    if (t = CSS.escape(t) !== t ? "r-" + btoa(t).replace(/=/g, "") : t, e.style.viewTransitionName = t, a != null && (e.style.viewTransitionClass = a), a = getComputedStyle(e), a.display === "inline") {
      if (t = e.getClientRects(), t.length === 1) var l = 1;
      else for (var s = l = 0; s < t.length; s++) {
        var u = t[s];
        0 < u.width && 0 < u.height && l++;
      }
      l === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + a.paddingTop, e.marginBottom = "-" + a.paddingBottom);
    }
  }
  function Vg(e, t) {
    e = e.style, t = t.style;
    var a = t != null ? t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null : null;
    e.viewTransitionName = a == null || typeof a == "boolean" ? "" : ("" + a).trim(), a = t != null ? t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null : null, e.viewTransitionClass = a == null || typeof a == "boolean" ? "" : ("" + a).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (a = t.display, e.display = a == null || typeof a == "boolean" ? "" : a, a = t.margin, a != null ? e.margin = a : (a = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = a == null || typeof a == "boolean" ? "" : a, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t)));
  }
  function Yg(e, t, a) {
    return a = a.ownerDocument.defaultView, {
      rect: e,
      abs: t.position === "absolute" || t.position === "fixed",
      clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
      view: 0 <= e.bottom && 0 <= e.right && e.top <= a.innerHeight && e.left <= a.innerWidth
    };
  }
  function Ud(e) {
    return Yg(e.getBoundingClientRect(), getComputedStyle(e), e);
  }
  function e2(e) {
    var t = e.getBoundingClientRect();
    t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
    var a = getComputedStyle(e);
    return Yg(t, a, e);
  }
  function t2(e) {
    return e.documentElement.clientHeight;
  }
  function n2(e) {
    this.addEventListener("load", e), this.addEventListener("error", e);
  }
  function a2(e, t, a, l, s, u, p, T, z) {
    var Y = t.nodeType === 9 ? t : t.ownerDocument;
    try {
      var F = Y.startViewTransition({
        update: function() {
          var U = Y.defaultView, K = U.navigation && U.navigation.transition, be = Y.fonts.status;
          l();
          var Ce = [];
          if (be === "loaded" && (t2(Y), Y.fonts.status === "loading" && Ce.push(Y.fonts.ready)), be = Ce.length, e !== null) for (var je = e.suspenseyImages, V = 0, L = 0; L < je.length; L++) {
            var P = je[L];
            if (!P.complete) {
              var oe = P.getBoundingClientRect();
              if (0 < oe.bottom && 0 < oe.right && oe.top < U.innerHeight && oe.left < U.innerWidth) {
                if (V += cy(P), V > gc) {
                  Ce.length = be;
                  break;
                }
                P = new Promise(n2.bind(P)), Ce.push(P);
              }
            }
          }
          if (0 < Ce.length) return U = Promise.race([Promise.all(Ce), new Promise(function(we) {
            return setTimeout(we, 500);
          })]).then(s, s), (K ? Promise.allSettled([K.finished, U]) : U).then(u, u);
          if (s(), K) return K.finished.then(u, u);
          u();
        },
        types: a
      });
      Y.__reactViewTransition = F;
      var le = [];
      return F.ready.then(function() {
        for (var U = Y.documentElement.getAnimations({ subtree: !0 }), K = 0; K < U.length; K++) {
          var be = U[K], Ce = be.effect, je = Ce.pseudoElement;
          if (je != null && je.startsWith("::view-transition")) {
            le.push(be), be = Ce.getKeyframes();
            for (var V = je = void 0, L = !0, P = 0; P < be.length; P++) {
              var oe = be[P], we = oe.width;
              if (je === void 0) je = we;
              else if (je !== we) {
                L = !1;
                break;
              }
              if (we = oe.height, V === void 0) V = we;
              else if (V !== we) {
                L = !1;
                break;
              }
              delete oe.width, delete oe.height, oe.transform === "none" && delete oe.transform;
            }
            L && je !== void 0 && V !== void 0 && (Ce.setKeyframes(be), L = getComputedStyle(Ce.target, Ce.pseudoElement), L.width !== je || L.height !== V) && (L = be[0], L.width = je, L.height = V, L = be[be.length - 1], L.width = je, L.height = V, Ce.setKeyframes(be));
          }
        }
        p();
      }, function(U) {
        Y.__reactViewTransition === F && (Y.__reactViewTransition = null);
        try {
          typeof U == "object" && U !== null && U.name === "InvalidStateError" && (U.message === "View transition was skipped because document visibility state is hidden." || U.message === "Skipping view transition because document visibility state has become hidden." || U.message === "Skipping view transition because viewport size changed." || U.message === "Transition was aborted because of invalid state") && (U = null), U !== null && z(U);
        } finally {
          l(), s(), p();
        }
      }), F.finished.finally(function() {
        for (var U = 0; U < le.length; U++) le[U].cancel();
        Y.__reactViewTransition === F && (Y.__reactViewTransition = null), T();
      }), F;
    } catch {
      return l(), s(), p(), null;
    }
  }
  function rl(e, t) {
    this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
  }
  rl.prototype.animate = function(e, t) {
    return t = typeof t == "number" ? { duration: t } : H({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
  }, rl.prototype.getAnimations = function() {
    for (var e = this._scope, t = this._selector, a = e.getAnimations({ subtree: !0 }), l = [], s = 0; s < a.length; s++) {
      var u = a[s].effect;
      u !== null && u.target === e && u.pseudoElement === t && l.push(a[s]);
    }
    return l;
  }, rl.prototype.getComputedStyle = function() {
    return getComputedStyle(this._scope, this._selector);
  };
  function qg(e) {
    return {
      name: e,
      group: new rl("group", e),
      imagePair: new rl("image-pair", e),
      old: new rl("old", e),
      new: new rl("new", e)
    };
  }
  function yn(e) {
    this._fragmentFiber = e, this._observers = this._eventListeners = null;
  }
  yn.prototype.addEventListener = function(e, t, a) {
    var l = null, s = null;
    if (!(a != null && typeof a != "boolean" && (l = a.signal || null, l !== null && l.aborted))) {
      this._eventListeners === null && (this._eventListeners = []);
      var u = this._eventListeners;
      if (Pg(u, e, t, a) === -1) {
        var p = this, T = t;
        a != null && typeof a != "boolean" && a.once === !0 && (T = function(z) {
          p.removeEventListener(e, t, a), typeof t == "function" ? t.call(this, z) : t.handleEvent(z);
        }), l !== null && (s = p.removeEventListener.bind(p, e, t, a), l.addEventListener("abort", s, { once: !0 }), s = l.removeEventListener.bind(l, "abort", s)), l = nr(a), u.push({
          type: e,
          listener: t,
          optionsOrUseCapture: a,
          attachedListener: T,
          cleanup: s
        }), v(this._fragmentFiber.child, !1, o2, e, T, l);
      }
      this._eventListeners = u;
    }
  };
  function o2(e, t, a, l) {
    return R(e).addEventListener(t, a, l), !1;
  }
  yn.prototype.removeEventListener = function(e, t, a) {
    var l = this._eventListeners;
    if (l !== null && (t = Pg(l, e, t, a), t !== -1)) {
      var s = l[t];
      a = s.attachedListener;
      var u = s.cleanup;
      s = nr(s.optionsOrUseCapture), v(this._fragmentFiber.child, !1, l2, e, a, s), l.splice(t, 1), u !== null && u();
    }
  };
  function l2(e, t, a, l) {
    return R(e).removeEventListener(t, a, l), !1;
  }
  function nr(e) {
    return e != null && typeof e != "boolean" && (e.once === !0 || e.signal instanceof AbortSignal) ? {
      capture: e.capture,
      passive: e.passive
    } : e;
  }
  function Gg(e) {
    return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
  }
  function Pg(e, t, a, l) {
    if (e.length === 0) return -1;
    l = Gg(l);
    for (var s = 0; s < e.length; s++) {
      var u = e[s];
      if (u.type === t && u.listener === a && Gg(u.optionsOrUseCapture) === l) return s;
    }
    return -1;
  }
  yn.prototype.dispatchEvent = function(e) {
    var t = x(this._fragmentFiber);
    if (t === null) return !0;
    t = R(t);
    var a = this._eventListeners;
    if (a !== null && 0 < a.length || !e.bubbles) {
      var l = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
      if (a) for (var s = 0; s < a.length; s++) {
        var u = a[s];
        l.addEventListener(u.type, u.attachedListener, nr(u.optionsOrUseCapture));
      }
      if (t.appendChild(l), e = l.dispatchEvent(e), a) for (s = 0; s < a.length; s++) u = a[s], l.removeEventListener(u.type, u.attachedListener, nr(u.optionsOrUseCapture));
      return t.removeChild(l), e;
    }
    return t.dispatchEvent(e);
  }, yn.prototype.focus = function(e) {
    v(this._fragmentFiber.child, !0, Xg, e, void 0, void 0);
  };
  function Xg(e, t) {
    return e.tag === 6 ? !1 : (e = R(e), g2(e, t));
  }
  yn.prototype.focusLast = function(e) {
    var t = [];
    v(this._fragmentFiber.child, !0, $d, t, void 0, void 0);
    for (var a = t.length - 1; 0 <= a && !Xg(t[a], e); a--) ;
  };
  function $d(e, t) {
    return t.push(e), !1;
  }
  yn.prototype.blur = function() {
    var e = x(this._fragmentFiber);
    e !== null && (e = R(e), e = di(e).activeElement, e !== null && v(this._fragmentFiber.child, !1, r2, e, void 0, void 0));
  };
  function r2(e, t) {
    return e.tag === 6 ? !1 : (e = R(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
  }
  yn.prototype.observeUsing = function(e) {
    this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), v(this._fragmentFiber.child, !1, i2, e, void 0, void 0);
  };
  function i2(e, t) {
    return e.tag === 6 || (e = R(e), t.observe(e)), !1;
  }
  yn.prototype.unobserveUsing = function(e) {
    var t = this._observers;
    if (t !== null && t.has(e)) {
      t.delete(e), v(this._fragmentFiber.child, !1, s2, e, void 0, void 0);
      for (var a = t = 0; a < Gn.length; a++) {
        var l = Gn[a];
        l.fragmentInstance === this && l.observer === e ? e.unobserve(l.instance) : Gn[t++] = l;
      }
      Gn.length = t;
    }
  };
  function s2(e, t) {
    return e.tag === 6 || (e = R(e), t.unobserve(e)), !1;
  }
  var Gn = [], Vd = !1;
  function c2(e, t, a) {
    Gn.push({
      fragmentInstance: e,
      observer: t,
      instance: a
    }), Vd || (Vd = !0, y2(function() {
      Vd = !1;
      var l = Gn;
      Gn = [];
      for (var s = 0; s < l.length; s++) {
        var u = l[s];
        u.observer.unobserve(u.instance);
      }
    }));
  }
  yn.prototype.getClientRects = function() {
    var e = [];
    return v(this._fragmentFiber.child, !1, u2, e, void 0, void 0), e;
  };
  function u2(e, t) {
    if (e.tag === 6) {
      e = e.stateNode;
      var a = e.ownerDocument.createRange();
      a.selectNodeContents(e), t.push.apply(t, a.getClientRects());
    } else e = R(e), t.push.apply(t, e.getClientRects());
    return !1;
  }
  yn.prototype.getRootNode = function(e) {
    var t = x(this._fragmentFiber);
    return t === null ? this : R(t).getRootNode(e);
  }, yn.prototype.compareDocumentPosition = function(e) {
    var t = x(this._fragmentFiber);
    if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
    var a = [];
    v(this._fragmentFiber.child, !1, $d, a, void 0, void 0);
    var l = R(t);
    if (a.length === 0) {
      if (a = l, E(this._fragmentFiber)) {
        e: {
          for (t = this._fragmentFiber.return; t !== null; ) {
            if (t.tag === 4) {
              t = t.stateNode.containerInfo;
              break e;
            }
            if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
            t = t.return;
          }
          t = null;
        }
        t != null && (a = t);
      }
      t = this._fragmentFiber;
      var s = l = a.compareDocumentPosition(e);
      return a === e ? s = Node.DOCUMENT_POSITION_CONTAINS : l & Node.DOCUMENT_POSITION_CONTAINED_BY && (a = C(t)[1], a === null ? s = Node.DOCUMENT_POSITION_PRECEDING : (e = R(a).compareDocumentPosition(e), s = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), s |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
    }
    t = R(a[0]), s = R(a[a.length - 1]);
    var u = E(this._fragmentFiber) ? t.parentElement : l;
    if (u == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
    l = u.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, u = u.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_CONTAINED_BY;
    var p = t.compareDocumentPosition(e), T = s.compareDocumentPosition(e), z = p & Node.DOCUMENT_POSITION_CONTAINED_BY || T & Node.DOCUMENT_POSITION_CONTAINED_BY;
    return T = l && u && p & Node.DOCUMENT_POSITION_FOLLOWING && T & Node.DOCUMENT_POSITION_PRECEDING, t = l && t === e || u && s === e || z || T ? Node.DOCUMENT_POSITION_CONTAINED_BY : !l && t === e || !u && s === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : p, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || f2(t, this._fragmentFiber, a[0], a[a.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
  };
  function f2(e, t, a, l, s) {
    var u = Ho(s);
    if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      if (a = !!u) e: {
        for (; u !== null; ) {
          if (u.tag === 7 && (u === t || u.alternate === t)) {
            a = !0;
            break e;
          }
          u = u.return;
        }
        a = !1;
      }
      return a;
    }
    if (e & Node.DOCUMENT_POSITION_CONTAINS) {
      if (u === null) return u = s.ownerDocument, s === u || s === u.documentElement || s === u.body;
      e: {
        for (u = t, t = x(t); u !== null; ) {
          if (!(u.tag !== 5 && u.tag !== 3 && u.tag !== 27 || u !== t && u.alternate !== t)) {
            u = !0;
            break e;
          }
          u = u.return;
        }
        u = !1;
      }
      return u;
    }
    return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!u) && !(t = u === a) && (t = $(a, u, j), t === null ? t = !1 : (v(t, !0, O, u, a), u = M, M = null, t = u !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!u) && !(t = u === l) && (t = $(l, u, j), t === null ? t = !1 : (v(t, !0, D, u, l), u = M, A = M = null, t = u !== null)), t) : !1;
  }
  function Ig(e, t) {
    var a = e.ownerDocument.createRange();
    a.selectNodeContents(e), e = a.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
  }
  yn.prototype.scrollIntoView = function(e) {
    if (typeof e == "object") throw Error(c(566));
    var t = [];
    v(this._fragmentFiber.child, !1, $d, t, void 0, void 0);
    var a = e !== !1;
    if (t.length === 0) {
      var l = C(this._fragmentFiber);
      if (l = a ? l[1] || l[0] || x(this._fragmentFiber) : l[0] || l[1], l === null) return;
      if (l.tag === 6) {
        e = R(l), Ig(e, a);
        return;
      }
      if (l = R(l), l.nodeType !== 9) {
        if (l.nodeType === 11) {
          a = "host" in l ? l.host : null, a !== null && a.scrollIntoView(e);
          return;
        }
        l.scrollIntoView(e);
      }
    }
    for (l = a ? t.length - 1 : 0; l !== (a ? -1 : t.length); ) {
      var s = t[l];
      s.tag === 6 ? (s = R(s), Ig(s, a)) : R(s).scrollIntoView(e), l += a ? -1 : 1;
    }
  };
  function d2(e, t) {
    return e = R(e), Qg(e, t), !1;
  }
  function Qg(e, t) {
    e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
  }
  function Zg(e, t) {
    var a = t._eventListeners;
    if (a !== null) for (var l = 0; l < a.length; l++) {
      var s = a[l];
      e.addEventListener(s.type, s.attachedListener, nr(s.optionsOrUseCapture));
    }
    e.nodeType !== 3 && (a = t._observers, a !== null && a.forEach(function(u) {
      for (var p = 0, T = 0; T < Gn.length; T++) {
        var z = Gn[T];
        (z.fragmentInstance !== t || z.observer !== u || z.instance !== e) && (Gn[p++] = z);
      }
      Gn.length = p, u.observe(e);
    }), Qg(e, t));
  }
  function m2(e, t) {
    var a = t._eventListeners;
    if (a !== null) for (var l = 0; l < a.length; l++) {
      var s = a[l];
      e.removeEventListener(s.type, s.attachedListener, nr(s.optionsOrUseCapture));
    }
    e.nodeType !== 3 && (a = t._observers, a !== null && a.forEach(function(u) {
      typeof u.rootMargin == "string" ? c2(t, u, e) : u.unobserve(e);
    }), e.reactFragments != null && e.reactFragments.delete(t));
  }
  function Yd(e) {
    var t = e.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var a = t;
      switch (t = t.nextSibling, a.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          Yd(a), ls(a);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (a.rel.toLowerCase() === "stylesheet") continue;
      }
      e.removeChild(a);
    }
  }
  function h2(e, t, a, l) {
    for (; e.nodeType === 1; ) {
      var s = a;
      if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!l && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
      } else if (l) {
        if (!e[Or]) switch (t) {
          case "meta":
            if (!e.hasAttribute("itemprop")) break;
            return e;
          case "link":
            if (u = e.getAttribute("rel"), u === "stylesheet" && e.hasAttribute("data-precedence")) break;
            if (u !== s.rel || e.getAttribute("href") !== (s.href == null || s.href === "" ? null : s.href) || e.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin) || e.getAttribute("title") !== (s.title == null ? null : s.title)) break;
            return e;
          case "style":
            if (e.hasAttribute("data-precedence")) break;
            return e;
          case "script":
            if (u = e.getAttribute("src"), (u !== (s.src == null ? null : s.src) || e.getAttribute("type") !== (s.type == null ? null : s.type) || e.getAttribute("crossorigin") !== (s.crossOrigin == null ? null : s.crossOrigin)) && u && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
            return e;
          default:
            return e;
        }
      } else if (t === "input" && e.type === "hidden") {
        var u = s.name == null ? null : "" + s.name;
        if (s.type === "hidden" && e.getAttribute("name") === u) return e;
      } else return e;
      if (e = jn(e.nextSibling), e === null) break;
    }
    return null;
  }
  function v2(e, t, a) {
    if (t === "") return null;
    for (; e.nodeType !== 3; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !a || (e = jn(e.nextSibling), e === null)) return null;
    return e;
  }
  function Kg(e, t) {
    for (; e.nodeType !== 8; )
      if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = jn(e.nextSibling), e === null)) return null;
    return e;
  }
  function qd(e) {
    return e.data === "$?" || e.data === "$~";
  }
  function Gd(e) {
    return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
  }
  function p2(e, t) {
    var a = e.ownerDocument;
    if (e.data === "$~") e._reactRetry = t;
    else if (e.data !== "$?" || a.readyState !== "loading") t();
    else {
      var l = function() {
        t(), a.removeEventListener("DOMContentLoaded", l);
      };
      a.addEventListener("DOMContentLoaded", l), e._reactRetry = l;
    }
  }
  function jn(e) {
    for (; e != null; e = e.nextSibling) {
      var t = e.nodeType;
      if (t === 1 || t === 3) break;
      if (t === 8) {
        if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
        if (t === "/$" || t === "/&") return null;
      }
    }
    return e;
  }
  var Pd = null;
  function Fg(e) {
    e = e.nextSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var a = e.data;
        if (a === "/$" || a === "/&") {
          if (t === 0) return jn(e.nextSibling);
          t--;
        } else a !== "$" && a !== "$!" && a !== "$?" && a !== "$~" && a !== "&" || t++;
      }
      e = e.nextSibling;
    }
    return null;
  }
  function Jg(e) {
    e = e.previousSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var a = e.data;
        if (a === "$" || a === "$!" || a === "$?" || a === "$~" || a === "&") {
          if (t === 0) return e;
          t--;
        } else a !== "/$" && a !== "/&" || t++;
      }
      e = e.previousSibling;
    }
    return null;
  }
  function g2(e, t) {
    function a() {
      l = !0;
    }
    if (e.ownerDocument.activeElement === e) return !0;
    var l = !1;
    try {
      e.ownerDocument.addEventListener("focus", a, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
    } finally {
      e.ownerDocument.removeEventListener("focus", a, !0);
    }
    return l;
  }
  function y2(e) {
    Hg(function() {
      Hg(function(t) {
        return e(t);
      });
    });
  }
  function Wg(e, t, a) {
    switch (t = di(a), e) {
      case "html":
        if (e = t.documentElement, !e) throw Error(c(452));
        return e;
      case "head":
        if (e = t.head, !e) throw Error(c(453));
        return e;
      case "body":
        if (e = t.body, !e) throw Error(c(454));
        return e;
      default:
        throw Error(c(451));
    }
  }
  function ey(e, t, a) {
    for (var l in a) {
      var s = a[l];
      a.hasOwnProperty(l) && s != null && Ke(e, t, l, null, IC, s);
    }
    a.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === Jn && (e.onclick = null), ls(e);
  }
  function Xd(e) {
    for (var t = e.attributes; t.length; ) e.removeAttributeNode(t[0]);
    ls(e);
  }
  var Dn = /* @__PURE__ */ new Map(), ty = /* @__PURE__ */ new Set();
  function mi(e) {
    if (typeof e.getRootNode == "function") {
      var t = e.getRootNode();
      if (t.nodeType === 9 || t.nodeType === 11) return t;
    }
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  var ja = de.d;
  de.d = {
    f: b2,
    r: S2,
    D: x2,
    C: w2,
    L: C2,
    m: E2,
    X: _2,
    S: T2,
    M: R2
  };
  function b2() {
    var e = ja.f(), t = sc();
    return e || t;
  }
  function S2(e) {
    var t = xl(e);
    t !== null && t.tag === 5 && t.type === "form" ? op(t) : ja.r(e);
  }
  var ar = typeof document > "u" ? null : document;
  function ny(e, t, a) {
    var l = ar;
    if (l && typeof t == "string" && t) {
      var s = Tn(t);
      s = 'link[rel="' + e + '"][href="' + s + '"]', typeof a == "string" && (s += '[crossorigin="' + a + '"]'), ty.has(s) || (ty.add(s), e = {
        rel: e,
        crossOrigin: a,
        href: t
      }, l.querySelector(s) === null && (t = l.createElement("link"), Ht(t, "link", e), Rt(t), l.head.appendChild(t)));
    }
  }
  function x2(e) {
    ja.D(e), ny("dns-prefetch", e, null);
  }
  function w2(e, t) {
    ja.C(e, t), ny("preconnect", e, t);
  }
  function C2(e, t, a) {
    ja.L(e, t, a);
    var l = ar;
    if (l && e && t) {
      var s = 'link[rel="preload"][as="' + Tn(t) + '"]';
      t === "image" && a && a.imageSrcSet ? (s += '[imagesrcset="' + Tn(a.imageSrcSet) + '"]', typeof a.imageSizes == "string" && (s += '[imagesizes="' + Tn(a.imageSizes) + '"]')) : s += '[href="' + Tn(e) + '"]';
      var u = s;
      switch (t) {
        case "style":
          u = or(e);
          break;
        case "script":
          u = lr(e);
      }
      if (!(Dn.has(u) || (e = H({
        rel: "preload",
        href: t === "image" && a && a.imageSrcSet ? void 0 : e,
        as: t
      }, a), Dn.set(u, e), l.querySelector(s) !== null || t === "style" && l.querySelector(hi(u)) || t === "script" && l.querySelector(vi(u))))) {
        var p = l.createElement("link");
        Ht(p, "link", e), t === "style" && (p[os] = !0, p.onload = p.onerror = function() {
          pv(p);
        }), Rt(p), l.head.appendChild(p);
      }
    }
  }
  function E2(e, t) {
    ja.m(e, t);
    var a = ar;
    if (a && e) {
      var l = t && typeof t.as == "string" ? t.as : "script", s = 'link[rel="modulepreload"][as="' + Tn(l) + '"][href="' + Tn(e) + '"]', u = s;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = lr(e);
      }
      if (!Dn.has(u) && (e = H({
        rel: "modulepreload",
        href: e
      }, t), Dn.set(u, e), a.querySelector(s) === null)) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (a.querySelector(vi(u))) return;
        }
        l = a.createElement("link"), Ht(l, "link", e), Rt(l), a.head.appendChild(l);
      }
    }
  }
  function T2(e, t, a) {
    ja.S(e, t, a);
    var l = ar;
    if (l && e) {
      var s = wl(l).hoistableStyles, u = or(e);
      t = t || "default";
      var p = s.get(u);
      if (!p) {
        var T = {
          loading: 0,
          preload: null
        };
        if (p = l.querySelector(hi(u))) T.loading = 5;
        else {
          e = H({
            rel: "stylesheet",
            href: e,
            "data-precedence": t
          }, a), (a = Dn.get(u)) && Id(e, a);
          var z = p = l.createElement("link");
          Rt(z), Ht(z, "link", e), z._p = new Promise(function(Y, F) {
            z.onload = Y, z.onerror = F;
          }), z.addEventListener("load", function() {
            T.loading |= 1;
          }), z.addEventListener("error", function() {
            T.loading |= 2;
          }), T.loading |= 4, vc(p, t, l);
        }
        p = {
          type: "stylesheet",
          instance: p,
          count: 1,
          state: T
        }, s.set(u, p);
      }
    }
  }
  function _2(e, t) {
    ja.X(e, t);
    var a = ar;
    if (a && e) {
      var l = wl(a).hoistableScripts, s = lr(e), u = l.get(s);
      u || (u = a.querySelector(vi(s)), u || (e = H({
        src: e,
        async: !0
      }, t), (t = Dn.get(s)) && Qd(e, t), u = a.createElement("script"), Rt(u), Ht(u, "link", e), a.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, l.set(s, u));
    }
  }
  function R2(e, t) {
    ja.M(e, t);
    var a = ar;
    if (a && e) {
      var l = wl(a).hoistableScripts, s = lr(e), u = l.get(s);
      u || (u = a.querySelector(vi(s)), u || (e = H({
        src: e,
        async: !0,
        type: "module"
      }, t), (t = Dn.get(s)) && Qd(e, t), u = a.createElement("script"), Rt(u), Ht(u, "link", e), a.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, l.set(s, u));
    }
  }
  function ay(e, t, a, l) {
    var s = (s = tt.current) ? mi(s) : null;
    if (!s) throw Error(c(446));
    switch (e) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof a.precedence == "string" && typeof a.href == "string" ? (a = or(a.href), t = wl(s).hoistableStyles, l = t.get(a), l || (l = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, t.set(a, l)), l) : {
          type: "void",
          instance: null,
          count: 0,
          state: null
        };
      case "link":
        if (a.rel === "stylesheet" && typeof a.href == "string" && typeof a.precedence == "string") {
          e = or(a.href);
          var u = wl(s).hoistableStyles, p = u.get(e);
          if (p || (s = s.ownerDocument || s, p = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: {
              loading: 0,
              preload: null
            }
          }, u.set(e, p), (u = s.querySelector(hi(e))) ? u._p || (p.instance = u, p.state.loading = 5) : (u = Dn.get(e), u || (u = {
            rel: "preload",
            as: "style",
            href: a.href,
            crossOrigin: a.crossOrigin,
            integrity: a.integrity,
            media: a.media,
            hrefLang: a.hrefLang,
            referrerPolicy: a.referrerPolicy
          }, Dn.set(e, u)), A2(s, e, u, p.state))), t && l === null) throw Error(c(528, ""));
          return p;
        }
        if (t && l !== null) throw Error(c(529, ""));
        return null;
      case "script":
        return t = a.async, a = a.src, typeof a == "string" && t && typeof t != "function" && typeof t != "symbol" ? (a = lr(a), t = wl(s).hoistableScripts, l = t.get(a), l || (l = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, t.set(a, l)), l) : {
          type: "void",
          instance: null,
          count: 0,
          state: null
        };
      default:
        throw Error(c(444, e));
    }
  }
  function or(e) {
    return 'href="' + Tn(e) + '"';
  }
  function hi(e) {
    return 'link[rel="stylesheet"][' + e + "]";
  }
  function oy(e) {
    return H({}, e, {
      "data-precedence": e.precedence,
      precedence: null
    });
  }
  function A2(e, t, a, l) {
    if (t = e.querySelector('link[rel="preload"][as="style"][' + t + "]")) {
      if (t[os] !== !0) {
        l.loading = 1;
        return;
      }
    } else t = e.createElement("link"), t[os] = !0, t.onload = t.onerror = pv.bind(null, t), Ht(t, "link", a), Rt(t), e.head.appendChild(t);
    l.preload = t, t.addEventListener("load", function() {
      return l.loading |= 1;
    }), t.addEventListener("error", function() {
      return l.loading |= 2;
    });
  }
  function lr(e) {
    return '[src="' + Tn(e) + '"]';
  }
  function vi(e) {
    return "script[async]" + e;
  }
  function ly(e, t, a) {
    if (t.count++, t.instance === null) switch (t.type) {
      case "style":
        var l = e.querySelector('style[data-href~="' + Tn(a.href) + '"]');
        if (l) return t.instance = l, Rt(l), l;
        var s = H({}, a, {
          "data-href": a.href,
          "data-precedence": a.precedence,
          href: null,
          precedence: null
        });
        return l = (e.ownerDocument || e).createElement("style"), Rt(l), Ht(l, "style", s), vc(l, a.precedence, e), t.instance = l;
      case "stylesheet":
        s = or(a.href);
        var u = e.querySelector(hi(s));
        if (u) return t.state.loading |= 4, t.instance = u, Rt(u), u;
        l = oy(a), (s = Dn.get(s)) && Id(l, s), u = (e.ownerDocument || e).createElement("link"), Rt(u);
        var p = u;
        return p._p = new Promise(function(T, z) {
          p.onload = T, p.onerror = z;
        }), Ht(u, "link", l), t.state.loading |= 4, vc(u, a.precedence, e), t.instance = u;
      case "script":
        return u = lr(a.src), (s = e.querySelector(vi(u))) ? (t.instance = s, Rt(s), s) : (l = a, (s = Dn.get(u)) && (l = H({}, a), Qd(l, s)), e = e.ownerDocument || e, s = e.createElement("script"), Rt(s), Ht(s, "link", l), e.head.appendChild(s), t.instance = s);
      case "void":
        return null;
      default:
        throw Error(c(443, t.type));
    }
    else t.type === "stylesheet" && (t.state.loading & 4) === 0 && (l = t.instance, t.state.loading |= 4, vc(l, a.precedence, e));
    return t.instance;
  }
  function vc(e, t, a) {
    for (var l = a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'), s = l.length ? l[l.length - 1] : null, u = s, p = 0; p < l.length; p++) {
      var T = l[p];
      if (T.dataset.precedence === t) u = T;
      else if (u !== s) break;
    }
    u ? u.parentNode.insertBefore(e, u.nextSibling) : (t = a.nodeType === 9 ? a.head : a, t.insertBefore(e, t.firstChild));
  }
  function Id(e, t) {
    e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
  }
  function Qd(e, t) {
    e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
  }
  var pc = null;
  function ry(e, t, a) {
    if (pc === null) {
      var l = /* @__PURE__ */ new Map(), s = pc = /* @__PURE__ */ new Map();
      s.set(a, l);
    } else s = pc, l = s.get(a), l || (l = /* @__PURE__ */ new Map(), s.set(a, l));
    if (l.has(e)) return l;
    for (l.set(e, null), a = a.getElementsByTagName(e), s = 0; s < a.length; s++) {
      var u = a[s];
      if (!(u[Or] || u[zt] || e === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
        var p = u.getAttribute(t) || "";
        p = e + p;
        var T = l.get(p);
        T ? T.push(u) : l.set(p, [u]);
      }
    }
    return l;
  }
  function Zd(e, t, a) {
    e = e.ownerDocument || e, e.head.insertBefore(a, t === "title" ? e.querySelector("head > title") : null);
  }
  function N2(e, t, a) {
    if (a === 1 || t.itemProp != null) return !1;
    switch (e) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
        return !0;
      case "link":
        if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
        return t.rel === "stylesheet" ? (e = t.disabled, typeof t.precedence == "string" && e == null) : !0;
      case "script":
        if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
    }
    return !1;
  }
  function iy(e, t) {
    return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
  }
  function sy(e) {
    return !(e.type === "stylesheet" && (e.state.loading & 3) === 0);
  }
  function cy(e) {
    return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * 0.25;
  }
  function uy(e, t) {
    typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += cy(t), e.suspenseyImages.push(t)), e = z2.bind(e), t.decode().then(e, e));
  }
  function O2(e, t, a, l) {
    if (a.type === "stylesheet" && (typeof l.media != "string" || matchMedia(l.media).matches !== !1) && (a.state.loading & 4) === 0) {
      if (a.instance === null) {
        var s = or(l.href), u = t.querySelector(hi(s));
        if (u) {
          t = u._p, t !== null && typeof t == "object" && typeof t.then == "function" && (e.count++, e = pi.bind(e), t.then(e, e)), a.state.loading |= 4, a.instance = u, Rt(u);
          return;
        }
        u = t.ownerDocument || t, l = oy(l), (s = Dn.get(s)) && Id(l, s), u = u.createElement("link"), Rt(u);
        var p = u;
        p._p = new Promise(function(T, z) {
          p.onload = T, p.onerror = z;
        }), Ht(u, "link", l), a.instance = u;
      }
      e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(a, t), (t = a.state.preload) && (a.state.loading & 3) === 0 && (e.count++, a = pi.bind(e), t.addEventListener("load", a), t.addEventListener("error", a));
    }
  }
  var gc = 0;
  function M2(e, t) {
    return e.stylesheets && e.count === 0 && bc(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(a) {
      var l = setTimeout(function() {
        if (e.stylesheets && bc(e, e.stylesheets), e.unsuspend) {
          var u = e.unsuspend;
          e.unsuspend = null, u();
        }
      }, 6e4 + t);
      0 < e.imgBytes && gc === 0 && (gc = 62500 * ZC());
      var s = setTimeout(function() {
        if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && bc(e, e.stylesheets), e.unsuspend)) {
          var u = e.unsuspend;
          e.unsuspend = null, u();
        }
      }, (e.imgBytes > gc ? 50 : 800) + t);
      return e.unsuspend = a, function() {
        e.unsuspend = null, clearTimeout(l), clearTimeout(s);
      };
    } : null;
  }
  function fy(e) {
    if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
      if (e.stylesheets) bc(e, e.stylesheets);
      else if (e.unsuspend) {
        var t = e.unsuspend;
        e.unsuspend = null, t();
      }
    }
  }
  function pi() {
    this.count--, fy(this);
  }
  function z2() {
    this.imgCount--, fy(this);
  }
  var yc = null;
  function bc(e, t) {
    e.stylesheets = null, e.unsuspend !== null && (e.count++, yc = /* @__PURE__ */ new Map(), t.forEach(j2, e), yc = null, pi.call(e));
  }
  function j2(e, t) {
    if (!(t.state.loading & 4)) {
      var a = yc.get(e);
      if (a) var l = a.get(null);
      else {
        a = /* @__PURE__ */ new Map(), yc.set(e, a);
        for (var s = e.querySelectorAll("link[data-precedence],style[data-precedence]"), u = 0; u < s.length; u++) {
          var p = s[u];
          (p.nodeName === "LINK" || p.getAttribute("media") !== "not all") && (a.set(p.dataset.precedence, p), l = p);
        }
        l && a.set(null, l);
      }
      s = t.instance, p = s.getAttribute("data-precedence"), u = a.get(p) || l, u === l && a.set(null, s), a.set(p, s), this.count++, l = pi.bind(this), s.addEventListener("load", l), s.addEventListener("error", l), u ? u.parentNode.insertBefore(s, u.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(s, e.firstChild)), t.state.loading |= 4;
    }
  }
  var rr = {
    $$typeof: B,
    Provider: null,
    Consumer: null,
    _currentValue: Ne,
    _currentValue2: Ne,
    _threadCount: 0
  };
  function D2(e, t, a, l, s, u, p, T, z) {
    this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Ou(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Ou(0), this.hiddenUpdates = Ou(null), this.identifierPrefix = l, this.onUncaughtError = s, this.onCaughtError = u, this.onRecoverableError = p, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = z, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function L2(e, t, a, l, s, u, p, T, z, Y, F, le) {
    return e = new D2(e, t, a, p, z, Y, F, le, T), t = 1, u === !0 && (t |= 24), u = Wt(3, null, null, t), e.current = u, u.stateNode = e, t = ff(), t.refCount++, e.pooledCache = t, t.refCount++, u.memoizedState = {
      element: l,
      isDehydrated: a,
      cache: t
    }, vf(u), e;
  }
  function B2(e) {
    return e ? (e = zl, e) : zl;
  }
  function dy(e, t, a, l, s, u) {
    s = B2(s), l.context === null ? l.context = s : l.pendingContext = s, l = Jo(t), l.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (l.callback = u), a = Wo(e, l, t), a !== null && (an(a, e, t), Ir(a, e, t));
  }
  function my(e, t) {
    if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
      var a = e.retryLane;
      e.retryLane = a !== 0 && a < t ? a : t;
    }
  }
  function Kd(e, t) {
    my(e, t), (e = e.alternate) && my(e, t);
  }
  function hy(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = Vo(e, 67108864);
      t !== null && an(t, e, 67108864), Kd(e, 67108864);
    }
  }
  function vy(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = zn();
      t = fv(t);
      var a = Vo(e, t);
      a !== null && an(a, e, t), Kd(e, t);
    }
  }
  var ir = !0;
  function H2(e, t, a, l) {
    var s = ve.T;
    ve.T = null;
    var u = de.p;
    try {
      de.p = 2, Fd(e, t, a, l);
    } finally {
      de.p = u, ve.T = s;
    }
  }
  function k2(e, t, a, l) {
    var s = ve.T;
    ve.T = null;
    var u = de.p;
    try {
      de.p = 8, Fd(e, t, a, l);
    } finally {
      de.p = u, ve.T = s;
    }
  }
  function Fd(e, t, a, l) {
    if (ir) {
      var s = Jd(l);
      if (s === null) zd(e, t, l, Sc, a), gy(e, l);
      else if ($2(s, e, t, a, l)) l.stopPropagation();
      else if (gy(e, l), t & 4 && -1 < U2.indexOf(e)) {
        for (; s !== null; ) {
          var u = xl(s);
          if (u !== null) switch (u.tag) {
            case 3:
              if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                var p = Bo(u.pendingLanes);
                if (p !== 0) {
                  var T = u;
                  for (T.pendingLanes |= 2, T.entangledLanes |= 2; p; ) {
                    var z = 1 << 31 - fn(p);
                    T.entanglements[1] |= z, p &= ~z;
                  }
                  za(u), (Ge & 6) === 0 && (lc = Yt() + 500, ci(0, !1));
                }
              }
              break;
            case 31:
            case 13:
              T = Vo(u, 2), T !== null && an(T, u, 2), sc(), Kd(u, 2);
          }
          if (u = Jd(l), u === null && zd(e, t, l, Sc, a), u === s) break;
          s = u;
        }
        s !== null && l.stopPropagation();
      } else zd(e, t, l, null, a);
    }
  }
  function Jd(e) {
    return e = Hu(e), Wd(e);
  }
  var Sc = null;
  function Wd(e) {
    if (Sc = null, e = Ho(e), e !== null) {
      var t = d(e);
      if (t === null) e = null;
      else {
        var a = t.tag;
        if (a === 13) {
          if (e = m(t), e !== null) return e;
          e = null;
        } else if (a === 31) {
          if (e = h(t), e !== null) return e;
          e = null;
        } else if (a === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
          e = null;
        } else t !== e && (e = null);
      }
    }
    return Sc = e, null;
  }
  function py(e) {
    switch (e) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "fullscreenerror":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "resize":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (Nu()) {
          case wt:
            return 2;
          case Ut:
            return 8;
          case Fa:
          case iw:
            return 32;
          case lv:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var em = !1, bo = null, So = null, xo = null, gi = /* @__PURE__ */ new Map(), yi = /* @__PURE__ */ new Map(), wo = [], U2 = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
  function gy(e, t) {
    switch (e) {
      case "focusin":
      case "focusout":
        bo = null;
        break;
      case "dragenter":
      case "dragleave":
        So = null;
        break;
      case "mouseover":
      case "mouseout":
        xo = null;
        break;
      case "pointerover":
      case "pointerout":
        gi.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        yi.delete(t.pointerId);
    }
  }
  function bi(e, t, a, l, s, u) {
    return e === null || e.nativeEvent !== u ? (e = {
      blockedOn: t,
      domEventName: a,
      eventSystemFlags: l,
      nativeEvent: u,
      targetContainers: [s]
    }, t !== null && (t = xl(t), t !== null && hy(t)), e) : (e.eventSystemFlags |= l, t = e.targetContainers, s !== null && t.indexOf(s) === -1 && t.push(s), e);
  }
  function $2(e, t, a, l, s) {
    switch (t) {
      case "focusin":
        return bo = bi(bo, e, t, a, l, s), !0;
      case "dragenter":
        return So = bi(So, e, t, a, l, s), !0;
      case "mouseover":
        return xo = bi(xo, e, t, a, l, s), !0;
      case "pointerover":
        var u = s.pointerId;
        return gi.set(u, bi(gi.get(u) || null, e, t, a, l, s)), !0;
      case "gotpointercapture":
        return u = s.pointerId, yi.set(u, bi(yi.get(u) || null, e, t, a, l, s)), !0;
    }
    return !1;
  }
  function yy(e) {
    var t = Ho(e.target);
    if (t !== null) {
      var a = d(t);
      if (a !== null) {
        if (t = a.tag, t === 13) {
          if (t = m(a), t !== null) {
            e.blockedOn = t, mv(e.priority, function() {
              vy(a);
            });
            return;
          }
        } else if (t === 31) {
          if (t = h(a), t !== null) {
            e.blockedOn = t, mv(e.priority, function() {
              vy(a);
            });
            return;
          }
        } else if (t === 3 && a.stateNode.current.memoizedState.isDehydrated) {
          e.blockedOn = a.tag === 3 ? a.stateNode.containerInfo : null;
          return;
        }
      }
    }
    e.blockedOn = null;
  }
  function xc(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
      var a = Jd(e.nativeEvent);
      if (a === null) {
        a = e.nativeEvent;
        var l = new a.constructor(a.type, a);
        Bu = l, a.target.dispatchEvent(l), Bu = null;
      } else return t = xl(a), t !== null && hy(t), e.blockedOn = a, !1;
      t.shift();
    }
    return !0;
  }
  function by(e, t, a) {
    xc(e) && a.delete(t);
  }
  function V2() {
    em = !1, bo !== null && xc(bo) && (bo = null), So !== null && xc(So) && (So = null), xo !== null && xc(xo) && (xo = null), gi.forEach(by), yi.forEach(by);
  }
  function wc(e, t) {
    e.blockedOn === t && (e.blockedOn = null, em || (em = !0, o.unstable_scheduleCallback(o.unstable_NormalPriority, V2)));
  }
  var Cc = null;
  function Sy(e) {
    Cc !== e && (Cc = e, o.unstable_scheduleCallback(o.unstable_NormalPriority, function() {
      Cc === e && (Cc = null);
      for (var t = 0; t < e.length; t += 3) {
        var a = e[t], l = e[t + 1], s = e[t + 2];
        if (typeof l != "function") {
          if (Wd(l || a) === null) continue;
          break;
        }
        var u = xl(a);
        u !== null && (e.splice(t, 3), t -= 3, Bf(u, {
          pending: !0,
          data: s,
          method: a.method,
          action: l
        }, l, s));
      }
    }));
  }
  function sr(e) {
    function t(z) {
      return wc(z, e);
    }
    bo !== null && wc(bo, e), So !== null && wc(So, e), xo !== null && wc(xo, e), gi.forEach(t), yi.forEach(t);
    for (var a = 0; a < wo.length; a++) {
      var l = wo[a];
      l.blockedOn === e && (l.blockedOn = null);
    }
    for (; 0 < wo.length && (a = wo[0], a.blockedOn === null); ) yy(a), a.blockedOn === null && wo.shift();
    if (a = (e.ownerDocument || e).$$reactFormReplay, a != null) for (l = 0; l < a.length; l += 3) {
      var s = a[l], u = a[l + 1], p = s[Jt] || null;
      if (typeof u == "function") p || Sy(a);
      else if (p) {
        var T = null;
        if (u && u.hasAttribute("formAction")) {
          if (s = u, p = u[Jt] || null) T = p.formAction;
          else if (Wd(s) !== null) continue;
        } else T = p.action;
        typeof T == "function" ? a[l + 1] = T : (a.splice(l, 3), l -= 3), Sy(a);
      }
    }
  }
  function Y2() {
    function e(u) {
      u.canIntercept && u.info === "react-transition" && u.intercept({
        handler: function() {
          return new Promise(function(p) {
            return s = p;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function t() {
      s !== null && (s(), s = null), l || setTimeout(a, 20);
    }
    function a() {
      if (!l && !navigation.transition) {
        var u = navigation.currentEntry;
        u && u.url != null && navigation.navigate(u.url, {
          state: u.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var l = !1, s = null;
      return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(a, 100), function() {
        l = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), s !== null && (s(), s = null);
      };
    }
  }
  function tm(e) {
    this._internalRoot = e;
  }
  nm.prototype.render = tm.prototype.render = function(e) {
    var t = this._internalRoot;
    if (t === null) throw Error(c(409));
    var a = t.current;
    dy(a, zn(), e, t, null, null);
  }, nm.prototype.unmount = tm.prototype.unmount = function() {
    var e = this._internalRoot;
    if (e !== null) {
      this._internalRoot = null;
      var t = e.containerInfo;
      dy(e.current, 2, null, e, null, null), sc(), t[Nr] = null;
    }
  };
  function nm(e) {
    this._internalRoot = e;
  }
  nm.prototype.unstable_scheduleHydration = function(e) {
    if (e) {
      var t = dv();
      e = {
        blockedOn: null,
        target: e,
        priority: t
      };
      for (var a = 0; a < wo.length && t !== 0 && t < wo[a].priority; a++) ;
      wo.splice(a, 0, e), a === 0 && yy(e);
    }
  };
  var xy = r.version;
  if (xy !== "19.3.0") throw Error(c(527, xy, "19.3.0"));
  de.findDOMNode = function(e) {
    var t = e._reactInternals;
    if (t === void 0)
      throw typeof e.render == "function" ? Error(c(188)) : (e = Object.keys(e).join(","), Error(c(268, e)));
    return e = w(t), e = e !== null ? b(e) : null, e = e === null ? null : e.stateNode, e;
  };
  var q2 = {
    bundleType: 0,
    version: "19.3.0",
    rendererPackageName: "react-dom",
    currentDispatcherRef: ve,
    reconcilerVersion: "19.3.0"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var Ec = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!Ec.isDisabled && Ec.supportsFiber) try {
      Rr = Ec.inject(q2), un = Ec;
    } catch {
    }
  }
  n.createRoot = function(e, t) {
    if (!f(e)) throw Error(c(299));
    var a = !1, l = "", s = pC, u = gC, p = yC;
    return t != null && (t.unstable_strictMode === !0 && (a = !0), t.identifierPrefix !== void 0 && (l = t.identifierPrefix), t.onUncaughtError !== void 0 && (s = t.onUncaughtError), t.onCaughtError !== void 0 && (u = t.onCaughtError), t.onRecoverableError !== void 0 && (p = t.onRecoverableError)), t = L2(e, 1, !1, null, null, a, l, null, s, u, p, Y2), e[Nr] = t.current, Rg(e), new tm(t);
  };
})), tE = /* @__PURE__ */ va(((n, o) => {
  function r() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r);
      } catch (i) {
        console.error(i);
      }
  }
  r(), o.exports = eE();
}));
function fa(n) {
  return Object.keys(n);
}
function am(n) {
  return n && typeof n == "object" && !Array.isArray(n);
}
function Km(n, o) {
  const r = { ...n }, i = o;
  return am(n) && am(o) && Object.keys(o).forEach((c) => {
    am(i[c]) && c in n ? r[c] = Km(r[c], i[c]) : r[c] = i[c];
  }), r;
}
function nE(n) {
  return n.replace(/[A-Z]/g, (o) => `-${o.toLowerCase()}`);
}
function aE(n) {
  return typeof n != "string" || !n.includes("var(--mantine-scale)") ? n : n.match(/^calc\((.*?)\)$/)?.[1].split("*")[0].trim();
}
function oE(n) {
  const o = aE(n);
  return typeof o == "number" ? o : typeof o == "string" ? o.includes("calc") || o.includes("var") ? o : o.includes("px") ? Number(o.replace("px", "")) : o.includes("rem") ? Number(o.replace("rem", "")) * 16 : o.includes("em") ? Number(o.replace("em", "")) * 16 : Number(o) : NaN;
}
function wy(n) {
  return n === "0rem" ? "0rem" : `calc(${n} * var(--mantine-scale))`;
}
function Ob(n, { shouldScale: o = !1 } = {}) {
  function r(i) {
    if (i === 0 || i === "0") return `0${n}`;
    if (typeof i == "number") {
      const c = `${i / 16}${n}`;
      return o ? wy(c) : c;
    }
    if (typeof i == "string") {
      if (i === "" || i.startsWith("calc(") || i.startsWith("clamp(") || i.includes("rgba(")) return i;
      if (i.includes(",")) return i.split(",").map((f) => r(f)).join(",");
      if (i.includes(" ")) return i.split(" ").map((f) => r(f)).join(" ");
      const c = i.replace("px", "");
      if (!Number.isNaN(Number(c))) {
        const f = `${Number(c) / 16}${n}`;
        return o ? wy(f) : f;
      }
    }
    return i;
  }
  return r;
}
var se = Ob("rem", { shouldScale: !0 }), Cy = Ob("em");
function Fm(n) {
  return Object.keys(n).reduce((o, r) => (n[r] !== void 0 && (o[r] = n[r]), o), {});
}
function Mb(n) {
  if (typeof n == "number") return !0;
  if (typeof n == "string") {
    if (n.startsWith("calc(") || n.startsWith("var(") || n.includes(" ") && n.trim() !== "") return !0;
    const o = /^[+-]?[0-9]+(\.[0-9]+)?(px|em|rem|ex|ch|lh|rlh|vw|vh|vmin|vmax|vb|vi|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|q|cqw|cqh|cqi|cqb|cqmin|cqmax|%)?$/;
    return n.trim().split(/\s+/).every((r) => o.test(r));
  }
  return !1;
}
var S = /* @__PURE__ */ Ab(Zm(), 1);
function Jm(n) {
  return Array.isArray(n) || n === null ? !1 : typeof n == "object" ? n.type !== S.Fragment : !1;
}
function Do(n) {
  const o = (0, S.createContext)(null);
  return [o, () => {
    const i = (0, S.use)(o);
    if (i === null) throw new Error(n);
    return i;
  }];
}
function $c(n, o) {
  let r = n;
  for (; (r = r.parentElement) && !r.matches(o); ) ;
  return r;
}
function Ey(n, o, r) {
  for (let i = n - 1; i >= 0; i -= 1) if (!o[i].disabled) return i;
  if (r) {
    for (let i = o.length - 1; i > -1; i -= 1) if (!o[i].disabled) return i;
  }
  return n;
}
function Ty(n, o, r) {
  for (let i = n + 1; i < o.length; i += 1) if (!o[i].disabled) return i;
  if (r) {
    for (let i = 0; i < o.length; i += 1) if (!o[i].disabled) return i;
  }
  return n;
}
function lE(n, o, r) {
  return $c(n, r) === $c(o, r);
}
function Wm({ parentSelector: n, siblingSelector: o, onKeyDown: r, loop: i = !0, activateOnFocus: c = !1, dir: f = "rtl", orientation: d }) {
  return (m) => {
    r?.(m);
    const h = Array.from($c(m.currentTarget, n)?.querySelectorAll(o) || []).filter((E) => lE(m.currentTarget, E, n)), g = h.findIndex((E) => m.currentTarget === E), w = Ty(g, h, i), b = Ey(g, h, i), v = f === "rtl" ? b : w, x = f === "rtl" ? w : b;
    switch (m.key) {
      case "ArrowRight":
        d === "horizontal" && (m.stopPropagation(), m.preventDefault(), h[v].focus(), c && h[v].click());
        break;
      case "ArrowLeft":
        d === "horizontal" && (m.stopPropagation(), m.preventDefault(), h[x].focus(), c && h[x].click());
        break;
      case "ArrowUp":
        d === "vertical" && (m.stopPropagation(), m.preventDefault(), h[b].focus(), c && h[b].click());
        break;
      case "ArrowDown":
        d === "vertical" && (m.stopPropagation(), m.preventDefault(), h[w].focus(), c && h[w].click());
        break;
      case "Home":
        m.stopPropagation(), m.preventDefault(), h[Ty(-1, h, !1)]?.focus();
        break;
      case "End":
        m.stopPropagation(), m.preventDefault(), h[Ey(h.length, h, !1)]?.focus();
    }
  };
}
var rE = {
  app: 100,
  modal: 200,
  popover: 300,
  overlay: 400,
  max: 9999
};
function Ya(n) {
  return rE[n];
}
var iE = () => {
};
function sE(n, o = { active: !0 }) {
  return typeof n != "function" || !o.active ? o.onKeyDown || iE : (r) => {
    r.key === "Escape" && (n(r), o.onTrigger?.());
  };
}
function $e(n, o = "size", r = !0) {
  if (n !== void 0)
    return Mb(n) ? r ? se(n) : n : `var(--${o}-${n})`;
}
function vr(n) {
  return $e(n, "mantine-spacing");
}
function St(n) {
  return n === void 0 ? "var(--mantine-radius-default)" : $e(n, "mantine-radius");
}
function Et(n) {
  return $e(n, "mantine-font-size");
}
function cE(n) {
  return $e(n, "mantine-line-height", !1);
}
function eh(n) {
  if (n)
    return $e(n, "mantine-shadow", !1);
}
function it(n, o) {
  return (r) => {
    n?.(r), o?.(r);
  };
}
function uE(n, o, r) {
  return r ? Array.from($c(r, o)?.querySelectorAll(n) || []).findIndex((i) => i === r) : null;
}
function Tm(n = "mantine-") {
  return `${n}${Math.random().toString(36).slice(2, 11)}`;
}
function fE(n, o) {
  if (n === o || Number.isNaN(n) && Number.isNaN(o)) return !0;
  if (!(n instanceof Object) || !(o instanceof Object)) return !1;
  const r = Object.keys(n), { length: i } = r;
  if (i !== Object.keys(o).length) return !1;
  for (let c = 0; c < i; c += 1) {
    const f = r[c];
    if (!(f in o) || n[f] !== o[f] && !(Number.isNaN(n[f]) && Number.isNaN(o[f]))) return !1;
  }
  return !0;
}
function mr(n) {
  const o = (0, S.useRef)(n);
  return (0, S.useEffect)(() => {
    o.current = n;
  }), (0, S.useMemo)(() => ((...r) => o.current?.(...r)), []);
}
function Qc(n, o) {
  const { delay: r, flushOnUnmount: i, leading: c, maxWait: f } = typeof o == "number" ? {
    delay: o,
    flushOnUnmount: !1,
    leading: !1,
    maxWait: void 0
  } : o, d = mr(n), m = (0, S.useRef)(0), h = (0, S.useRef)(0), g = (0, S.useRef)(null), w = (0, S.useMemo)(() => {
    const b = Object.assign((...v) => {
      window.clearTimeout(m.current), g.current = v;
      const x = b._isFirstCall;
      b._isFirstCall = !1;
      function E() {
        window.clearTimeout(m.current), window.clearTimeout(h.current), m.current = 0, h.current = 0, b._isFirstCall = !0, b._hasPendingCallback = !1;
      }
      function C() {
        f !== void 0 && h.current === 0 && (h.current = window.setTimeout(() => {
          if (m.current !== 0) {
            const M = g.current;
            E(), d(...M);
          }
        }, f));
      }
      if (c && x) {
        d(...v);
        const M = () => {
          E();
        }, A = () => {
          m.current !== 0 && (E(), d(...v));
        }, O = () => {
          E();
        };
        b.flush = A, b.cancel = O, m.current = window.setTimeout(M, r), C();
        return;
      }
      if (c && !x) {
        b._hasPendingCallback = !0;
        const M = () => {
          m.current !== 0 && (E(), d(...v));
        }, A = () => {
          E();
        };
        b.flush = M, b.cancel = A;
        const O = () => {
          E();
        };
        m.current = window.setTimeout(O, r), C();
        return;
      }
      b._hasPendingCallback = !0;
      const _ = () => {
        m.current !== 0 && (E(), d(...v));
      }, R = () => {
        E();
      };
      b.flush = _, b.cancel = R, m.current = window.setTimeout(_, r), C();
    }, {
      flush: () => {
      },
      cancel: () => {
      },
      isPending: () => b._hasPendingCallback,
      _isFirstCall: !0,
      _hasPendingCallback: !1
    });
    return b;
  }, [
    d,
    r,
    c,
    f
  ]);
  return (0, S.useEffect)(() => () => {
    i ? w.flush() : w.cancel();
  }, [w, i]), w;
}
var dE = ["mousedown", "touchstart"];
function mE(n, o, r, i = !0) {
  const c = (0, S.useRef)(null), f = o || dE, d = (0, S.useEffectEvent)((h) => {
    const { target: g } = h ?? {};
    if (!document.body.contains(g) && g?.tagName !== "HTML") return;
    const w = h.composedPath();
    Array.isArray(r) ? r.every((b) => !!b && !w.includes(b)) && n(h) : c.current && !w.includes(c.current) && n(h);
  }), m = f.join(",");
  return (0, S.useEffect)(() => {
    if (!i) return;
    const h = m.split(",");
    return h.forEach((g) => document.addEventListener(g, d)), () => {
      h.forEach((g) => document.removeEventListener(g, d));
    };
  }, [m, i]), c;
}
function hE(n, o) {
  return typeof o == "boolean" ? o : typeof window < "u" && "matchMedia" in window ? window.matchMedia(n).matches : !1;
}
function vE(n, o, { getInitialValueInEffect: r } = { getInitialValueInEffect: !0 }) {
  const [i, c] = (0, S.useState)(r ? o : hE(n));
  return (0, S.useEffect)(() => {
    try {
      if ("matchMedia" in window) {
        const f = window.matchMedia(n);
        c(f.matches);
        const d = (m) => c(m.matches);
        return f.addEventListener("change", d), () => {
          f.removeEventListener("change", d);
        };
      }
    } catch {
      return;
    }
  }, [n]), i || !1;
}
var Ua = typeof document < "u" ? S.useLayoutEffect : S.useEffect;
function pE(n, o) {
  return n.length !== o.length || o.some((r, i) => !Object.is(r, n[i]));
}
function th(n, o) {
  const r = (0, S.useRef)(!1), i = (0, S.useRef)(null), c = (0, S.useRef)(void 0), f = {};
  (0, S.useEffect)(() => {
    const d = i.current === f, m = c.current;
    if (i.current = f, c.current = o, !r.current) {
      r.current = !0;
      return;
    }
    if (!d && !(o && m && !pE(m, o)))
      return n();
  }, o);
}
function zb({ opened: n, shouldReturnFocus: o = !0 }) {
  const r = (0, S.useRef)(null), i = () => {
    r.current && "focus" in r.current && typeof r.current.focus == "function" && r.current?.focus({ preventScroll: !0 });
  };
  return th(() => {
    let c = -1;
    const f = (d) => {
      d.key === "Tab" && window.clearTimeout(c);
    };
    if (document.addEventListener("keydown", f), n) r.current = document.activeElement;
    else if (o) {
      const d = document.activeElement;
      c = window.setTimeout(() => {
        const m = document.activeElement;
        (m === null || m === document.body || m === d) && i();
      }, 10);
    }
    return () => {
      window.clearTimeout(c), document.removeEventListener("keydown", f);
    };
  }, [n, o]), i;
}
var gE = /input|select|textarea|button|object/, jb = "a, input, select, textarea, button, object, [tabindex]";
function yE(n) {
  return n.style.display === "none";
}
function bE(n) {
  if (n.getAttribute("aria-hidden") || n.getAttribute("hidden") || n.getAttribute("type") === "hidden") return !1;
  let o = n;
  for (; o && !(o === document.body || o.nodeType === 11); ) {
    if (yE(o)) return !1;
    o = o.parentNode;
  }
  return !0;
}
function Db(n) {
  let o = n.getAttribute("tabindex");
  return o === null && (o = void 0), parseInt(o, 10);
}
function _m(n) {
  const o = n.nodeName.toLowerCase(), r = !Number.isNaN(Db(n));
  return (gE.test(o) && !n.disabled || n instanceof HTMLAnchorElement && n.href || r) && bE(n);
}
function Lb(n) {
  const o = Db(n);
  return (Number.isNaN(o) || o >= 0) && _m(n);
}
function SE(n) {
  return Array.from(n.querySelectorAll(jb)).filter(Lb);
}
function xE(n, o) {
  const r = SE(n);
  if (!r.length) {
    o.preventDefault();
    return;
  }
  const i = r[o.shiftKey ? 0 : r.length - 1], c = n.getRootNode();
  let f = i === c.activeElement || n === c.activeElement;
  const d = c.activeElement;
  if (d.tagName === "INPUT" && d.getAttribute("type") === "radio" && (f = r.filter((h) => h.getAttribute("type") === "radio" && h.getAttribute("name") === d.getAttribute("name")).includes(i)), !f) return;
  o.preventDefault();
  const m = r[o.shiftKey ? r.length - 1 : 0];
  m && m.focus();
}
function wE(n = !0) {
  const o = (0, S.useRef)(null), r = (c) => {
    let f = c.querySelector("[data-autofocus]");
    if (!f) {
      const d = Array.from(c.querySelectorAll(jb));
      f = d.find(Lb) || d.find(_m) || null, !f && _m(c) && (f = c);
    }
    f ? f.focus({ preventScroll: !0 }) : console.warn("[@mantine/hooks/use-focus-trap] Failed to find focusable element within provided node", c);
  }, i = (0, S.useCallback)((c) => {
    if (n) {
      if (c === null) {
        o.current = null;
        return;
      }
      o.current !== c && (setTimeout(() => {
        c.getRootNode() ? r(c) : console.warn("[@mantine/hooks/use-focus-trap] Ref node is not part of the dom", c);
      }), o.current = c);
    }
  }, [n]);
  return (0, S.useEffect)(() => {
    if (!n) return;
    o.current && setTimeout(() => {
      o.current && r(o.current);
    });
    const c = (f) => {
      f.key === "Tab" && o.current && xE(o.current, f);
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, [n]), i;
}
function bn(n) {
  const o = (0, S.useId)(), [r, i] = (0, S.useState)(`mantine-${o.replace(/:/g, "")}`), c = (0, S.useRef)(!1);
  return Ua(() => {
    c.current || (c.current = !0, i(Tm()));
  }, []), typeof n == "string" ? n : r;
}
function CE(n, o, r) {
  const i = (0, S.useEffectEvent)(o);
  (0, S.useEffect)(() => (window.addEventListener(n, i, r), () => window.removeEventListener(n, i, r)), [n]);
}
function Rm(n, o) {
  if (typeof n == "function") return n(o);
  typeof n == "object" && n !== null && "current" in n && (n.current = o);
}
function EE(...n) {
  const o = /* @__PURE__ */ new Map();
  return (r) => {
    if (n.forEach((i) => {
      const c = Rm(i, r);
      c && o.set(i, c);
    }), o.size > 0) return () => {
      n.forEach((i) => {
        const c = o.get(i);
        c && typeof c == "function" ? c() : Rm(i, null);
      }), o.clear();
    };
  };
}
function st(...n) {
  return (0, S.useCallback)(EE(...n), n);
}
function Kt({ value: n, defaultValue: o, finalValue: r, onChange: i = () => {
} }) {
  const [c, f] = (0, S.useState)(o !== void 0 ? o : r), d = (m, ...h) => {
    f(m), i?.(m, ...h);
  };
  return n !== void 0 ? [
    n,
    i,
    !0
  ] : [
    c,
    d,
    !1
  ];
}
function nh(n, o) {
  return vE("(prefers-reduced-motion: reduce)", n, o);
}
function TE(n, o) {
  if (!n || !o) return !1;
  if (n === o) return !0;
  if (n.length !== o.length) return !1;
  for (let r = 0; r < n.length; r += 1) if (!fE(n[r], o[r])) return !1;
  return !0;
}
function _E(n) {
  const o = (0, S.useRef)([]), r = (0, S.useRef)(0);
  return TE(o.current, n) || (o.current = n, r.current += 1), [r.current];
}
function _y(n, o) {
  (0, S.useEffect)(n, _E(o));
}
function RE(n, o, r = { autoInvoke: !1 }) {
  const i = (0, S.useRef)(null), c = mr(n), f = (0, S.useCallback)((...m) => {
    i.current || (i.current = window.setTimeout(() => {
      c(...m), i.current = null;
    }, o));
  }, [o]), d = (0, S.useCallback)(() => {
    i.current && (window.clearTimeout(i.current), i.current = null);
  }, []);
  return (0, S.useEffect)(() => (r.autoInvoke && f(), d), [d, f]), {
    start: f,
    clear: d
  };
}
function AE(n) {
  const o = (0, S.useRef)(void 0);
  return (0, S.useEffect)(() => {
    o.current = n;
  }, [n]), o.current;
}
function NE(n, o, r) {
  const i = (0, S.useRef)(null);
  (0, S.useEffect)(() => {
    i.current && (i.current.disconnect(), i.current = null);
    const c = typeof r == "function" ? r() : r;
    return c && (i.current = new MutationObserver(n), i.current.observe(c, o)), () => {
      i.current && (i.current.disconnect(), i.current = null);
    };
  }, [
    n,
    o,
    r
  ]);
}
function OE() {
  const [n, o] = (0, S.useState)(!1);
  return (0, S.useEffect)(() => o(!0), []), n;
}
var ME = ["mouse", "touch"], zE = 10;
function jE(n, o = {}) {
  const { threshold: r = 400, events: i = ME, cancelOnMove: c = !1, onStart: f, onFinish: d, onCancel: m } = o, h = (0, S.useRef)(!1), g = (0, S.useRef)(!1), w = (0, S.useRef)(-1), b = (0, S.useRef)(null);
  (0, S.useEffect)(() => () => window.clearTimeout(w.current), []);
  const v = i.join(",");
  return (0, S.useMemo)(() => {
    if (typeof n != "function") return {};
    const x = c !== !1, E = c === !0 ? zE : c === !1 ? 0 : c, C = (A) => {
      !Ay(A) && !Am(A) || (f && f(A), b.current = Ry(A), g.current = !0, w.current = window.setTimeout(() => {
        n(A), h.current = !0;
      }, r));
    }, _ = (A) => {
      !Ay(A) && !Am(A) || (h.current ? d && d(A) : g.current && m && m(A), h.current = !1, g.current = !1, b.current = null, w.current !== -1 && (window.clearTimeout(w.current), w.current = -1));
    }, R = (A) => {
      if (!x || !g.current || h.current) return;
      const O = Ry(A);
      if (!O || !b.current) return;
      const D = O.x - b.current.x, j = O.y - b.current.y;
      Math.sqrt(D * D + j * j) > E && _(A);
    }, M = {};
    return i.includes("mouse") && (M.onMouseDown = C, M.onMouseUp = _, M.onMouseLeave = _, x && (M.onMouseMove = R)), i.includes("touch") && (M.onTouchStart = C, M.onTouchEnd = _, M.onTouchCancel = _, x && (M.onTouchMove = R)), M;
  }, [
    n,
    r,
    m,
    d,
    f,
    c,
    v
  ]);
}
function Ry(n) {
  if (Am(n)) {
    const o = n.touches[0] ?? n.changedTouches[0];
    return o ? {
      x: o.clientX,
      y: o.clientY
    } : null;
  }
  return {
    x: n.clientX,
    y: n.clientY
  };
}
function Am(n) {
  return window.TouchEvent ? n.nativeEvent instanceof TouchEvent : "touches" in n.nativeEvent;
}
function Ay(n) {
  return n.nativeEvent instanceof MouseEvent;
}
function Bb() {
  return typeof process < "u" && process.env, "development";
}
function Zc(n) {
  return "19.3.0".startsWith("18.") ? n?.ref : n?.props?.ref;
}
function DE(n) {
  return typeof n == "string" || typeof n == "number" || typeof n == "boolean" || typeof n == "bigint";
}
function jc(n, o = document) {
  const r = o.querySelector(n);
  if (r) return r;
  const i = o.querySelectorAll("*");
  for (let c = 0; c < i.length; c += 1) {
    const f = i[c];
    if (f.shadowRoot) {
      const d = jc(n, f.shadowRoot);
      if (d) return d;
    }
  }
  return null;
}
function Da(n, o = document) {
  const r = [], i = o.querySelectorAll(n);
  r.push(...Array.from(i));
  const c = o.querySelectorAll("*");
  for (let f = 0; f < c.length; f += 1) {
    const d = c[f];
    if (d.shadowRoot) {
      const m = Da(n, d.shadowRoot);
      r.push(...m);
    }
  }
  return r;
}
function sa(n) {
  if (!n) return document;
  const o = n.getRootNode();
  return o instanceof ShadowRoot || o instanceof Document ? o : document;
}
function qa(n) {
  const o = S.Children.toArray(n);
  return o.length !== 1 || !Jm(o[0]) ? null : o[0];
}
function Hb(n) {
  var o, r, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var c = n.length;
    for (o = 0; o < c; o++) n[o] && (r = Hb(n[o])) && (i && (i += " "), i += r);
  } else for (r in n) n[r] && (i && (i += " "), i += r);
  return i;
}
function kt() {
  for (var n, o, r = 0, i = "", c = arguments.length; r < c; r++) (n = arguments[r]) && (o = Hb(n)) && (i && (i += " "), i += o);
  return i;
}
var LE = {};
function BE(n) {
  const o = {};
  return n.forEach((r) => {
    Object.entries(r).forEach(([i, c]) => {
      o[i] ? o[i] = kt(o[i], c) : o[i] = c;
    });
  }), o;
}
function Ai({ theme: n, classNames: o, props: r, stylesCtx: i }) {
  return BE((Array.isArray(o) ? o : [o]).map((c) => typeof c == "function" ? c(n, r, i) : c || LE));
}
function Vc({ theme: n, styles: o, props: r, stylesCtx: i }) {
  const c = Array.isArray(o) ? o : [o], f = {};
  for (const d of c) typeof d == "function" ? Object.assign(f, d(n, r, i)) : d && Object.assign(f, d);
  return f;
}
function Ny(n) {
  return n === "auto" || n === "dark" || n === "light";
}
function HE({ key: n = "mantine-color-scheme-value" } = {}) {
  let o;
  return {
    get: (r) => {
      if (typeof window > "u") return r;
      try {
        const i = window.localStorage.getItem(n);
        return Ny(i) ? i : r;
      } catch {
        return r;
      }
    },
    set: (r) => {
      try {
        window.localStorage.setItem(n, r);
      } catch (i) {
        console.warn("[@mantine/core] Local storage color scheme manager was unable to save color scheme.", i);
      }
    },
    subscribe: (r) => {
      o = (i) => {
        i.storageArea === window.localStorage && i.key === n && Ny(i.newValue) && r(i.newValue);
      }, window.addEventListener("storage", o);
    },
    unsubscribe: () => {
      window.removeEventListener("storage", o);
    },
    clear: () => {
      window.localStorage.removeItem(n);
    }
  };
}
function Ni(n, o) {
  return typeof n.primaryShade == "number" ? n.primaryShade : o === "dark" ? n.primaryShade.dark : n.primaryShade.light;
}
function kE(n) {
  return /^#?([0-9A-F]{3}){1,2}([0-9A-F]{2})?$/i.test(n);
}
function UE(n) {
  let o = n.replace("#", "");
  if (o.length === 3) {
    const i = o.split("");
    o = [
      i[0],
      i[0],
      i[1],
      i[1],
      i[2],
      i[2]
    ].join("");
  }
  if (o.length === 8) {
    const i = parseInt(o.slice(6, 8), 16) / 255;
    return {
      r: parseInt(o.slice(0, 2), 16),
      g: parseInt(o.slice(2, 4), 16),
      b: parseInt(o.slice(4, 6), 16),
      a: i
    };
  }
  const r = parseInt(o, 16);
  return {
    r: r >> 16 & 255,
    g: r >> 8 & 255,
    b: r & 255,
    a: 1
  };
}
function $E(n) {
  const [o, r, i, c] = n.replace(/[^0-9,./]/g, "").split(/[/,]/).map(Number);
  return {
    r: o,
    g: r,
    b: i,
    a: c === void 0 ? 1 : c
  };
}
function VE(n) {
  const o = n.match(/^hsla?\(\s*(\d+)\s*,\s*(\d+%)\s*,\s*(\d+%)\s*(,\s*(0?\.\d+|\d+(\.\d+)?))?\s*\)$/i);
  if (!o) return {
    r: 0,
    g: 0,
    b: 0,
    a: 1
  };
  const r = parseInt(o[1], 10), i = parseInt(o[2], 10) / 100, c = parseInt(o[3], 10) / 100, f = o[5] ? parseFloat(o[5]) : void 0, d = (1 - Math.abs(2 * c - 1)) * i, m = r / 60, h = d * (1 - Math.abs(m % 2 - 1)), g = c - d / 2;
  let w, b, v;
  return m >= 0 && m < 1 ? (w = d, b = h, v = 0) : m >= 1 && m < 2 ? (w = h, b = d, v = 0) : m >= 2 && m < 3 ? (w = 0, b = d, v = h) : m >= 3 && m < 4 ? (w = 0, b = h, v = d) : m >= 4 && m < 5 ? (w = h, b = 0, v = d) : (w = d, b = 0, v = h), {
    r: Math.round((w + g) * 255),
    g: Math.round((b + g) * 255),
    b: Math.round((v + g) * 255),
    a: f || 1
  };
}
function ah(n) {
  return kE(n) ? UE(n) : n.startsWith("rgb") ? $E(n) : n.startsWith("hsl") ? VE(n) : {
    r: 0,
    g: 0,
    b: 0,
    a: 1
  };
}
function om(n) {
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}
function YE(n) {
  const o = n.match(/oklch\((.*?)%\s/);
  return o ? parseFloat(o[1]) : null;
}
function qE(n) {
  if (n.startsWith("oklch(")) return (YE(n) || 0) / 100;
  const { r: o, g: r, b: i } = ah(n), c = o / 255, f = r / 255, d = i / 255, m = om(c), h = om(f), g = om(d);
  return 0.2126 * m + 0.7152 * h + 0.0722 * g;
}
function Si(n, o = 0.179) {
  return n.startsWith("var(") ? !1 : qE(n) > o;
}
function pa({ color: n, theme: o, colorScheme: r }) {
  if (typeof n != "string") throw new Error(`[@mantine/core] Failed to parse color. Expected color to be a string, instead got ${typeof n}`);
  if (n === "bright") return {
    color: n,
    value: r === "dark" ? o.white : o.black,
    shade: void 0,
    isThemeColor: !1,
    isLight: Si(r === "dark" ? o.white : o.black, o.luminanceThreshold),
    variable: "--mantine-color-bright"
  };
  if (n === "dimmed") return {
    color: n,
    value: r === "dark" ? o.colors.dark[2] : o.colors.gray[7],
    shade: void 0,
    isThemeColor: !1,
    isLight: Si(r === "dark" ? o.colors.dark[2] : o.colors.gray[6], o.luminanceThreshold),
    variable: "--mantine-color-dimmed"
  };
  if (n === "white" || n === "black") return {
    color: n,
    value: n === "white" ? o.white : o.black,
    shade: void 0,
    isThemeColor: !1,
    isLight: Si(n === "white" ? o.white : o.black, o.luminanceThreshold),
    variable: `--mantine-color-${n}`
  };
  const [i, c] = n.split("."), f = c ? Number(c) : void 0, d = i in o.colors;
  if (d) {
    const m = f !== void 0 ? o.colors[i][f] : o.colors[i][Ni(o, r || "light")];
    return {
      color: i,
      value: m,
      shade: f,
      isThemeColor: d,
      isLight: Si(m, o.luminanceThreshold),
      variable: c ? `--mantine-color-${i}-${f}` : `--mantine-color-${i}-filled`
    };
  }
  return {
    color: n,
    value: n,
    isThemeColor: d,
    isLight: Si(n, o.luminanceThreshold),
    shade: f,
    variable: void 0
  };
}
function It(n, o) {
  const r = pa({
    color: n || o.primaryColor,
    theme: o
  });
  return r.variable ? `var(${r.variable})` : n;
}
function GE(n) {
  return Array.isArray(n) ? n : Array(10).fill(n);
}
function oh(n) {
  return !!n && typeof n == "object" && "mantine-virtual-color" in n;
}
function fl(n, o) {
  if (n.startsWith("var(")) return `color-mix(in srgb, ${n}, black ${o * 100}%)`;
  const { r, g: i, b: c, a: f } = ah(n), d = 1 - o, m = (h) => Math.round(h * d);
  return `rgba(${m(r)}, ${m(i)}, ${m(c)}, ${f})`;
}
function Nm(n, o) {
  const r = {
    from: n?.from || o.defaultGradient.from,
    to: n?.to || o.defaultGradient.to,
    deg: n?.deg ?? o.defaultGradient.deg ?? 0
  }, i = It(r.from, o), c = It(r.to, o);
  return `linear-gradient(${r.deg}deg, ${i} 0%, ${c} 100%)`;
}
function Eo(n, o) {
  if (typeof n != "string" || o > 1 || o < 0) return "rgba(0, 0, 0, 1)";
  if (n.startsWith("var(")) return `color-mix(in srgb, ${n}, transparent ${(1 - o) * 100}%)`;
  if (n.startsWith("oklch"))
    return n.includes("/") ? n.replace(/\/\s*[\d.]+\s*\)/, `/ ${o})`) : n.replace(")", ` / ${o})`);
  const { r, g: i, b: c } = ah(n);
  return `rgba(${r}, ${i}, ${c}, ${o})`;
}
var Oy = Eo, kb = ({ color: n, theme: o, variant: r, gradient: i, autoContrast: c }) => {
  const f = pa({
    color: n,
    theme: o
  }), d = typeof c == "boolean" ? c : o.autoContrast;
  if (r === "none") return {
    background: "transparent",
    hover: "transparent",
    color: "inherit",
    border: "none"
  };
  if (r === "filled") {
    const m = f.isThemeColor && f.shade === void 0 && oh(o.colors[f.color]), h = d ? m ? `var(--mantine-color-${f.color}-contrast)` : f.isLight ? "var(--mantine-color-black)" : "var(--mantine-color-white)" : "var(--mantine-color-white)";
    return f.isThemeColor ? f.shade === void 0 ? {
      background: `var(--mantine-color-${n}-filled)`,
      hover: `var(--mantine-color-${n}-filled-hover)`,
      color: h,
      border: `${se(1)} solid transparent`
    } : {
      background: `var(--mantine-color-${f.color}-${f.shade})`,
      hover: `var(--mantine-color-${f.color}-${f.shade === 9 ? 8 : f.shade + 1})`,
      color: h,
      border: `${se(1)} solid transparent`
    } : {
      background: n,
      hover: fl(n, 0.1),
      color: h,
      border: `${se(1)} solid transparent`
    };
  }
  if (r === "light") {
    if (f.isThemeColor) {
      if (f.shade === void 0) return {
        background: `var(--mantine-color-${n}-light)`,
        hover: `var(--mantine-color-${n}-light-hover)`,
        color: `var(--mantine-color-${n}-light-color)`,
        border: `${se(1)} solid transparent`
      };
      const m = o.colors[f.color][f.shade];
      return {
        background: m,
        hover: fl(m, 0.1),
        color: `var(--mantine-color-${f.color}-light-color)`,
        border: `${se(1)} solid transparent`
      };
    }
    return {
      background: Eo(n, 0.1),
      hover: Eo(n, 0.12),
      color: n,
      border: `${se(1)} solid transparent`
    };
  }
  if (r === "outline")
    return f.isThemeColor ? f.shade === void 0 ? {
      background: "transparent",
      hover: `var(--mantine-color-${n}-outline-hover)`,
      color: `var(--mantine-color-${n}-outline)`,
      border: `${se(1)} solid var(--mantine-color-${n}-outline)`
    } : {
      background: "transparent",
      hover: Eo(o.colors[f.color][f.shade], 0.05),
      color: `var(--mantine-color-${f.color}-${f.shade})`,
      border: `${se(1)} solid var(--mantine-color-${f.color}-${f.shade})`
    } : {
      background: "transparent",
      hover: Eo(n, 0.05),
      color: n,
      border: `${se(1)} solid ${n}`
    };
  if (r === "subtle") {
    if (f.isThemeColor) {
      if (f.shade === void 0) return {
        background: "transparent",
        hover: `var(--mantine-color-${n}-light-hover)`,
        color: `var(--mantine-color-${n}-light-color)`,
        border: `${se(1)} solid transparent`
      };
      const m = o.colors[f.color][f.shade];
      return {
        background: "transparent",
        hover: Eo(m, 0.12),
        color: `var(--mantine-color-${f.color}-${Math.min(f.shade, 6)})`,
        border: `${se(1)} solid transparent`
      };
    }
    return {
      background: "transparent",
      hover: Eo(n, 0.12),
      color: n,
      border: `${se(1)} solid transparent`
    };
  }
  return r === "transparent" ? f.isThemeColor ? f.shade === void 0 ? {
    background: "transparent",
    hover: "transparent",
    color: `var(--mantine-color-${n}-light-color)`,
    border: `${se(1)} solid transparent`
  } : {
    background: "transparent",
    hover: "transparent",
    color: `var(--mantine-color-${f.color}-${Math.min(f.shade, 6)})`,
    border: `${se(1)} solid transparent`
  } : {
    background: "transparent",
    hover: "transparent",
    color: n,
    border: `${se(1)} solid transparent`
  } : r === "white" ? f.isThemeColor ? f.shade === void 0 ? {
    background: "var(--mantine-color-white)",
    hover: fl(o.white, 0.01),
    color: `var(--mantine-color-${n}-filled)`,
    border: `${se(1)} solid transparent`
  } : {
    background: "var(--mantine-color-white)",
    hover: fl(o.white, 0.01),
    color: `var(--mantine-color-${f.color}-${f.shade})`,
    border: `${se(1)} solid transparent`
  } : {
    background: "var(--mantine-color-white)",
    hover: fl(o.white, 0.01),
    color: n,
    border: `${se(1)} solid transparent`
  } : r === "gradient" ? {
    background: Nm(i, o),
    hover: Nm(i, o),
    color: "var(--mantine-color-white)",
    border: "none"
  } : r === "default" ? {
    background: "var(--mantine-color-default)",
    hover: "var(--mantine-color-default-hover)",
    color: "var(--mantine-color-default-color)",
    border: `${se(1)} solid var(--mantine-color-default-border)`
  } : {};
};
function Hi({ color: n, theme: o, autoContrast: r, colorScheme: i }) {
  return (typeof r == "boolean" ? r : o.autoContrast) && pa({
    color: n || o.primaryColor,
    theme: o,
    colorScheme: i
  }).isLight ? "var(--mantine-color-black)" : "var(--mantine-color-white)";
}
function Om(n, o, r) {
  return Hi({
    color: r === "dark" ? n.dark : n.light,
    theme: o,
    colorScheme: r,
    autoContrast: !0
  });
}
function My(n, o) {
  const r = n.colors[n.primaryColor];
  return oh(r) ? n.autoContrast ? Om(r, n, o) : "var(--mantine-color-white)" : Hi({
    color: r[Ni(n, o)],
    theme: n,
    autoContrast: null
  });
}
function Ub(n, o) {
  return typeof n == "boolean" ? n : o.autoContrast;
}
var lh = (0, S.createContext)(null);
function Ga() {
  const n = (0, S.use)(lh);
  if (!n) throw new Error("[@mantine/core] MantineProvider was not found in tree");
  return n;
}
function PE() {
  return Ga().cssVariablesResolver;
}
function XE() {
  return Ga().classNamesPrefix;
}
function rh() {
  return Ga().getStyleNonce;
}
function IE() {
  return Ga().withStaticClasses;
}
function QE() {
  return Ga().headless;
}
function ZE() {
  return Ga().stylesTransform?.sx;
}
function KE() {
  return Ga().stylesTransform?.styles;
}
function ih() {
  return Ga().env || "default";
}
function FE() {
  return Ga().deduplicateInlineStyles;
}
function cr(n, o) {
  const r = typeof window < "u" && "matchMedia" in window && window.matchMedia("(prefers-color-scheme: dark)")?.matches, i = n !== "auto" ? n : r ? "dark" : "light";
  o()?.setAttribute("data-mantine-color-scheme", i);
}
function JE({ manager: n, defaultColorScheme: o, getRootElement: r, forceColorScheme: i }) {
  const c = (0, S.useRef)(null), [f, d] = (0, S.useState)(() => n.get(o)), m = i || f, h = (0, S.useCallback)((w) => {
    i || (cr(w, r), d(w), n.set(w));
  }, [
    n.set,
    m,
    i
  ]), g = (0, S.useCallback)(() => {
    d(o), cr(o, r), n.clear();
  }, [n.clear, o]);
  return (0, S.useEffect)(() => (n.subscribe(h), n.unsubscribe), [n.subscribe, n.unsubscribe]), Ua(() => {
    cr(n.get(o), r);
  }, []), (0, S.useEffect)(() => {
    if (i)
      return cr(i, r), () => {
      };
    i === void 0 && cr(f, r), typeof window < "u" && "matchMedia" in window && (c.current = window.matchMedia("(prefers-color-scheme: dark)"));
    const w = (b) => {
      f === "auto" && cr(b.matches ? "dark" : "light", r);
    };
    return c.current?.addEventListener("change", w), () => c.current?.removeEventListener("change", w);
  }, [f, i]), {
    colorScheme: m,
    setColorScheme: h,
    clearColorScheme: g
  };
}
var WE = /* @__PURE__ */ va(((n) => {
  var o = /* @__PURE__ */ Symbol.for("react.transitional.element"), r = /* @__PURE__ */ Symbol.for("react.fragment");
  function i(c, f, d) {
    var m = null;
    if (d !== void 0 && (m = "" + d), f.key !== void 0 && (m = "" + f.key), "key" in f) {
      d = {};
      for (var h in f) h !== "key" && (d[h] = f[h]);
    } else d = f;
    return f = d.ref, {
      $$typeof: o,
      type: c,
      key: m,
      ref: f !== void 0 ? f : null,
      props: d
    };
  }
  n.Fragment = r, n.jsx = i, n.jsxs = i;
})), eT = /* @__PURE__ */ va(((n, o) => {
  o.exports = WE();
})), tT = {
  dark: [
    "#C9C9C9",
    "#b8b8b8",
    "#828282",
    "#696969",
    "#424242",
    "#3b3b3b",
    "#2e2e2e",
    "#242424",
    "#1f1f1f",
    "#141414"
  ],
  gray: [
    "#f8f9fa",
    "#f1f3f5",
    "#e9ecef",
    "#dee2e6",
    "#ced4da",
    "#adb5bd",
    "#868e96",
    "#495057",
    "#343a40",
    "#212529"
  ],
  red: [
    "#fff5f5",
    "#ffe3e3",
    "#ffc9c9",
    "#ffa8a8",
    "#ff8787",
    "#ff6b6b",
    "#fa5252",
    "#f03e3e",
    "#e03131",
    "#c92a2a"
  ],
  pink: [
    "#fff0f6",
    "#ffdeeb",
    "#fcc2d7",
    "#faa2c1",
    "#f783ac",
    "#f06595",
    "#e64980",
    "#d6336c",
    "#c2255c",
    "#a61e4d"
  ],
  grape: [
    "#f8f0fc",
    "#f3d9fa",
    "#eebefa",
    "#e599f7",
    "#da77f2",
    "#cc5de8",
    "#be4bdb",
    "#ae3ec9",
    "#9c36b5",
    "#862e9c"
  ],
  violet: [
    "#f3f0ff",
    "#e5dbff",
    "#d0bfff",
    "#b197fc",
    "#9775fa",
    "#845ef7",
    "#7950f2",
    "#7048e8",
    "#6741d9",
    "#5f3dc4"
  ],
  indigo: [
    "#edf2ff",
    "#dbe4ff",
    "#bac8ff",
    "#91a7ff",
    "#748ffc",
    "#5c7cfa",
    "#4c6ef5",
    "#4263eb",
    "#3b5bdb",
    "#364fc7"
  ],
  blue: [
    "#e7f5ff",
    "#d0ebff",
    "#a5d8ff",
    "#74c0fc",
    "#4dabf7",
    "#339af0",
    "#228be6",
    "#1c7ed6",
    "#1971c2",
    "#1864ab"
  ],
  cyan: [
    "#e3fafc",
    "#c5f6fa",
    "#99e9f2",
    "#66d9e8",
    "#3bc9db",
    "#22b8cf",
    "#15aabf",
    "#1098ad",
    "#0c8599",
    "#0b7285"
  ],
  teal: [
    "#e6fcf5",
    "#c3fae8",
    "#96f2d7",
    "#63e6be",
    "#38d9a9",
    "#20c997",
    "#12b886",
    "#0ca678",
    "#099268",
    "#087f5b"
  ],
  green: [
    "#ebfbee",
    "#d3f9d8",
    "#b2f2bb",
    "#8ce99a",
    "#69db7c",
    "#51cf66",
    "#40c057",
    "#37b24d",
    "#2f9e44",
    "#2b8a3e"
  ],
  lime: [
    "#f4fce3",
    "#e9fac8",
    "#d8f5a2",
    "#c0eb75",
    "#a9e34b",
    "#94d82d",
    "#82c91e",
    "#74b816",
    "#66a80f",
    "#5c940d"
  ],
  yellow: [
    "#fff9db",
    "#fff3bf",
    "#ffec99",
    "#ffe066",
    "#ffd43b",
    "#fcc419",
    "#fab005",
    "#f59f00",
    "#f08c00",
    "#e67700"
  ],
  orange: [
    "#fff4e6",
    "#ffe8cc",
    "#ffd8a8",
    "#ffc078",
    "#ffa94d",
    "#ff922b",
    "#fd7e14",
    "#f76707",
    "#e8590c",
    "#d9480f"
  ]
}, zy = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji", sh = {
  scale: 1,
  fontSmoothing: !0,
  focusRing: "auto",
  white: "#fff",
  black: "#000",
  colors: tT,
  primaryShade: {
    light: 6,
    dark: 8
  },
  primaryColor: "blue",
  variantColorResolver: kb,
  autoContrast: !1,
  luminanceThreshold: 0.3,
  fontFamily: zy,
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  respectReducedMotion: !1,
  cursorType: "default",
  defaultGradient: {
    from: "blue",
    to: "cyan",
    deg: 45
  },
  defaultRadius: "md",
  activeClassName: "mantine-active",
  focusClassName: "",
  headings: {
    fontFamily: zy,
    fontWeight: "700",
    textWrap: "wrap",
    sizes: {
      h1: {
        fontSize: se(34),
        lineHeight: "1.3"
      },
      h2: {
        fontSize: se(26),
        lineHeight: "1.35"
      },
      h3: {
        fontSize: se(22),
        lineHeight: "1.4"
      },
      h4: {
        fontSize: se(18),
        lineHeight: "1.45"
      },
      h5: {
        fontSize: se(16),
        lineHeight: "1.5"
      },
      h6: {
        fontSize: se(14),
        lineHeight: "1.5"
      }
    }
  },
  fontSizes: {
    xs: se(12),
    sm: se(14),
    md: se(16),
    lg: se(18),
    xl: se(20)
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.45",
    md: "1.55",
    lg: "1.6",
    xl: "1.65"
  },
  fontWeights: {
    regular: "400",
    medium: "600",
    bold: "700"
  },
  radius: {
    xs: se(2),
    sm: se(4),
    md: se(8),
    lg: se(16),
    xl: se(32)
  },
  spacing: {
    xs: se(10),
    sm: se(12),
    md: se(16),
    lg: se(20),
    xl: se(32)
  },
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "62em",
    lg: "75em",
    xl: "88em"
  },
  shadows: {
    xs: `0 ${se(1)} ${se(3)} rgba(0, 0, 0, 0.05), 0 ${se(1)} ${se(2)} rgba(0, 0, 0, 0.1)`,
    sm: `0 ${se(1)} ${se(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${se(10)} ${se(15)} ${se(-5)}, rgba(0, 0, 0, 0.04) 0 ${se(7)} ${se(7)} ${se(-5)}`,
    md: `0 ${se(1)} ${se(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${se(20)} ${se(25)} ${se(-5)}, rgba(0, 0, 0, 0.04) 0 ${se(10)} ${se(10)} ${se(-5)}`,
    lg: `0 ${se(1)} ${se(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${se(28)} ${se(23)} ${se(-7)}, rgba(0, 0, 0, 0.04) 0 ${se(12)} ${se(12)} ${se(-7)}`,
    xl: `0 ${se(1)} ${se(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${se(36)} ${se(28)} ${se(-7)}, rgba(0, 0, 0, 0.04) 0 ${se(17)} ${se(17)} ${se(-7)}`
  },
  other: {},
  components: {}
}, nT = "[@mantine/core] MantineProvider: Invalid theme.primaryColor, it accepts only key of theme.colors, learn more – https://mantine.dev/theming/colors/#primary-color", jy = "[@mantine/core] MantineProvider: Invalid theme.primaryShade, it accepts only 0-9 integers or an object { light: 0-9, dark: 0-9 }";
function lm(n) {
  return n < 0 || n > 9 ? !1 : parseInt(n.toString(), 10) === n;
}
function Dy(n) {
  if (!(n.primaryColor in n.colors)) throw new Error(nT);
  if (typeof n.primaryShade == "object" && (!lm(n.primaryShade.dark) || !lm(n.primaryShade.light)))
    throw new Error(jy);
  if (typeof n.primaryShade == "number" && !lm(n.primaryShade)) throw new Error(jy);
}
function aT(n, o) {
  if (!o)
    return Dy(n), n;
  const r = Km(n, o);
  return o.fontFamily && !o.headings?.fontFamily && (r.headings = {
    ...r.headings,
    fontFamily: o.fontFamily
  }), Dy(r), r;
}
var y = eT(), ch = (0, S.createContext)(null), oT = () => (0, S.use)(ch) || sh;
function Bn() {
  const n = (0, S.use)(ch);
  if (!n) throw new Error("@mantine/core: MantineProvider was not found in component tree, make sure you have it in your app");
  return n;
}
function uh({ theme: n, children: o, inherit: r = !0 }) {
  const i = oT(), c = (0, S.useMemo)(() => aT(r ? i : sh, n), [
    n,
    i,
    r
  ]);
  return /* @__PURE__ */ (0, y.jsx)(ch, {
    value: c,
    children: o
  });
}
uh.displayName = "@mantine/core/MantineThemeProvider";
function rm(n) {
  return Object.entries(n).map(([o, r]) => `${o}: ${r};`).join("");
}
function $b(n, o) {
  const r = o ? [o] : [":root", ":host"], i = rm(n.variables), c = i ? `${r.join(", ")}{${i}}` : "", f = rm(n.dark), d = rm(n.light), m = (h) => r.map((g) => g === ":host" ? `${g}([data-mantine-color-scheme="${h}"])` : `${g}[data-mantine-color-scheme="${h}"]`).join(", ");
  return `${c}

${f ? `${m("dark")}{${f}}` : ""}

${d ? `${m("light")}{${d}}` : ""}`;
}
function Tc({ theme: n, color: o, colorScheme: r, name: i = o, withColorValues: c = !0 }) {
  if (!n.colors[o]) return {};
  if (r === "light") {
    const m = Ni(n, "light"), h = {
      [`--mantine-color-${i}-text`]: `var(--mantine-color-${i}-filled)`,
      [`--mantine-color-${i}-filled`]: `var(--mantine-color-${i}-${m})`,
      [`--mantine-color-${i}-filled-hover`]: `var(--mantine-color-${i}-${m === 9 ? 8 : m + 1})`,
      [`--mantine-color-${i}-light`]: `var(--mantine-color-${i}-1)`,
      [`--mantine-color-${i}-light-hover`]: `var(--mantine-color-${i}-2)`,
      [`--mantine-color-${i}-light-color`]: `var(--mantine-color-${i}-9)`,
      [`--mantine-color-${i}-outline`]: `var(--mantine-color-${i}-${m})`,
      [`--mantine-color-${i}-outline-hover`]: Oy(n.colors[o][m], 0.05)
    };
    return c ? {
      [`--mantine-color-${i}-0`]: n.colors[o][0],
      [`--mantine-color-${i}-1`]: n.colors[o][1],
      [`--mantine-color-${i}-2`]: n.colors[o][2],
      [`--mantine-color-${i}-3`]: n.colors[o][3],
      [`--mantine-color-${i}-4`]: n.colors[o][4],
      [`--mantine-color-${i}-5`]: n.colors[o][5],
      [`--mantine-color-${i}-6`]: n.colors[o][6],
      [`--mantine-color-${i}-7`]: n.colors[o][7],
      [`--mantine-color-${i}-8`]: n.colors[o][8],
      [`--mantine-color-${i}-9`]: n.colors[o][9],
      ...h
    } : h;
  }
  const f = Ni(n, "dark"), d = {
    [`--mantine-color-${i}-text`]: `var(--mantine-color-${i}-4)`,
    [`--mantine-color-${i}-filled`]: `var(--mantine-color-${i}-${f})`,
    [`--mantine-color-${i}-filled-hover`]: `var(--mantine-color-${i}-${f === 9 ? 8 : f + 1})`,
    [`--mantine-color-${i}-light`]: fl(n.colors[o][9], 0.5),
    [`--mantine-color-${i}-light-hover`]: fl(n.colors[o][9], 0.3),
    [`--mantine-color-${i}-light-color`]: `var(--mantine-color-${i}-0)`,
    [`--mantine-color-${i}-outline`]: `var(--mantine-color-${i}-${Math.max(f - 4, 0)})`,
    [`--mantine-color-${i}-outline-hover`]: Oy(n.colors[o][Math.max(f - 4, 0)], 0.05)
  };
  return c ? {
    [`--mantine-color-${i}-0`]: n.colors[o][0],
    [`--mantine-color-${i}-1`]: n.colors[o][1],
    [`--mantine-color-${i}-2`]: n.colors[o][2],
    [`--mantine-color-${i}-3`]: n.colors[o][3],
    [`--mantine-color-${i}-4`]: n.colors[o][4],
    [`--mantine-color-${i}-5`]: n.colors[o][5],
    [`--mantine-color-${i}-6`]: n.colors[o][6],
    [`--mantine-color-${i}-7`]: n.colors[o][7],
    [`--mantine-color-${i}-8`]: n.colors[o][8],
    [`--mantine-color-${i}-9`]: n.colors[o][9],
    ...d
  } : d;
}
function il(n, o, r) {
  fa(o).forEach((i) => Object.assign(n, { [`--mantine-${r}-${i}`]: o[i] }));
}
var Vb = (n) => {
  const o = Ni(n, "light"), r = n.defaultRadius in n.radius ? n.radius[n.defaultRadius] : se(n.defaultRadius), i = {
    variables: {
      "--mantine-z-index-app": "100",
      "--mantine-z-index-modal": "200",
      "--mantine-z-index-popover": "300",
      "--mantine-z-index-overlay": "400",
      "--mantine-z-index-max": "9999",
      "--mantine-scale": n.scale.toString(),
      "--mantine-cursor-type": n.cursorType,
      "--mantine-webkit-font-smoothing": n.fontSmoothing ? "antialiased" : "unset",
      "--mantine-moz-font-smoothing": n.fontSmoothing ? "grayscale" : "unset",
      "--mantine-color-white": n.white,
      "--mantine-color-black": n.black,
      "--mantine-line-height": n.lineHeights.md,
      "--mantine-font-family": n.fontFamily,
      "--mantine-font-family-monospace": n.fontFamilyMonospace,
      "--mantine-font-family-headings": n.headings.fontFamily,
      "--mantine-heading-font-weight": n.headings.fontWeight,
      "--mantine-heading-text-wrap": n.headings.textWrap,
      "--mantine-radius-default": r,
      "--mantine-primary-color-filled": `var(--mantine-color-${n.primaryColor}-filled)`,
      "--mantine-primary-color-filled-hover": `var(--mantine-color-${n.primaryColor}-filled-hover)`,
      "--mantine-primary-color-light": `var(--mantine-color-${n.primaryColor}-light)`,
      "--mantine-primary-color-light-hover": `var(--mantine-color-${n.primaryColor}-light-hover)`,
      "--mantine-primary-color-light-color": `var(--mantine-color-${n.primaryColor}-light-color)`
    },
    light: {
      "--mantine-color-scheme": "light",
      "--mantine-primary-color-contrast": My(n, "light"),
      "--mantine-color-bright": "var(--mantine-color-black)",
      "--mantine-color-text": n.black,
      "--mantine-color-body": n.white,
      "--mantine-color-error": "var(--mantine-color-red-6)",
      "--mantine-color-success": "var(--mantine-color-teal-8)",
      "--mantine-color-placeholder": "var(--mantine-color-gray-5)",
      "--mantine-color-anchor": `var(--mantine-color-${n.primaryColor}-${o})`,
      "--mantine-color-default": "var(--mantine-color-white)",
      "--mantine-color-default-hover": "var(--mantine-color-gray-0)",
      "--mantine-color-default-color": "var(--mantine-color-black)",
      "--mantine-color-default-border": "var(--mantine-color-gray-4)",
      "--mantine-color-dimmed": "var(--mantine-color-gray-6)",
      "--mantine-color-disabled": "var(--mantine-color-gray-2)",
      "--mantine-color-disabled-color": "var(--mantine-color-gray-5)",
      "--mantine-color-disabled-border": "var(--mantine-color-gray-3)"
    },
    dark: {
      "--mantine-color-scheme": "dark",
      "--mantine-primary-color-contrast": My(n, "dark"),
      "--mantine-color-bright": "var(--mantine-color-white)",
      "--mantine-color-text": "var(--mantine-color-dark-0)",
      "--mantine-color-body": "var(--mantine-color-dark-7)",
      "--mantine-color-error": "var(--mantine-color-red-8)",
      "--mantine-color-success": "var(--mantine-color-teal-8)",
      "--mantine-color-placeholder": "var(--mantine-color-dark-3)",
      "--mantine-color-anchor": `var(--mantine-color-${n.primaryColor}-4)`,
      "--mantine-color-default": "var(--mantine-color-dark-6)",
      "--mantine-color-default-hover": "var(--mantine-color-dark-5)",
      "--mantine-color-default-color": "var(--mantine-color-white)",
      "--mantine-color-default-border": "var(--mantine-color-dark-4)",
      "--mantine-color-dimmed": "var(--mantine-color-dark-2)",
      "--mantine-color-disabled": "var(--mantine-color-dark-6)",
      "--mantine-color-disabled-color": "var(--mantine-color-dark-3)",
      "--mantine-color-disabled-border": "var(--mantine-color-dark-4)"
    }
  };
  il(i.variables, n.breakpoints, "breakpoint"), il(i.variables, n.spacing, "spacing"), il(i.variables, n.fontSizes, "font-size"), il(i.variables, n.lineHeights, "line-height"), il(i.variables, n.shadows, "shadow"), il(i.variables, n.radius, "radius"), il(i.variables, n.fontWeights, "font-weight"), n.colors[n.primaryColor].forEach((f, d) => {
    i.variables[`--mantine-primary-color-${d}`] = `var(--mantine-color-${n.primaryColor}-${d})`;
  }), fa(n.colors).forEach((f) => {
    const d = n.colors[f];
    if (oh(d)) {
      Object.assign(i.light, Tc({
        theme: n,
        name: d.name,
        color: d.light,
        colorScheme: "light",
        withColorValues: !0
      })), Object.assign(i.dark, Tc({
        theme: n,
        name: d.name,
        color: d.dark,
        colorScheme: "dark",
        withColorValues: !0
      })), i.light[`--mantine-color-${d.name}-contrast`] = Om(d, n, "light"), i.dark[`--mantine-color-${d.name}-contrast`] = Om(d, n, "dark");
      return;
    }
    d.forEach((m, h) => {
      i.variables[`--mantine-color-${f}-${h}`] = m;
    }), Object.assign(i.light, Tc({
      theme: n,
      color: f,
      colorScheme: "light",
      withColorValues: !1
    })), Object.assign(i.dark, Tc({
      theme: n,
      color: f,
      colorScheme: "dark",
      withColorValues: !1
    }));
  });
  const c = n.headings.sizes;
  return fa(c).forEach((f) => {
    i.variables[`--mantine-${f}-font-size`] = c[f].fontSize, i.variables[`--mantine-${f}-line-height`] = c[f].lineHeight, i.variables[`--mantine-${f}-font-weight`] = c[f].fontWeight || n.headings.fontWeight;
  }), i;
};
function lT() {
  const n = Bn(), o = rh(), r = fa(n.breakpoints).reduce((i, c) => {
    const f = n.breakpoints[c].includes("px"), d = oE(n.breakpoints[c]);
    return `${i}@media (max-width: ${f ? `${d - 0.1}px` : Cy(d - 0.1)}) {.mantine-visible-from-${c} {display: none !important;}}@media (min-width: ${f ? `${d}px` : Cy(d)}) {.mantine-hidden-from-${c} {display: none !important;}}`;
  }, "");
  return /* @__PURE__ */ (0, y.jsx)("style", {
    "data-mantine-styles": "classes",
    nonce: o?.(),
    dangerouslySetInnerHTML: { __html: r }
  });
}
function rT({ theme: n, generator: o }) {
  const r = Vb(n), i = o?.(n);
  return i ? Km(r, i) : r;
}
var im = Vb(sh);
function iT(n) {
  const o = {
    variables: {},
    light: {},
    dark: {}
  };
  return fa(n.variables).forEach((r) => {
    im.variables[r] !== n.variables[r] && (o.variables[r] = n.variables[r]);
  }), fa(n.light).forEach((r) => {
    im.light[r] !== n.light[r] && (o.light[r] = n.light[r]);
  }), fa(n.dark).forEach((r) => {
    im.dark[r] !== n.dark[r] && (o.dark[r] = n.dark[r]);
  }), o;
}
function sT(n) {
  return $b({
    variables: {},
    dark: { "--mantine-color-scheme": "dark" },
    light: { "--mantine-color-scheme": "light" }
  }, n);
}
function Yb({ cssVariablesSelector: n, deduplicateCssVariables: o }) {
  const r = Bn(), i = rh(), c = PE(), f = rT({
    theme: r,
    generator: c
  }), d = (n === void 0 || n === ":root" || n === ":host") && o, m = d ? iT(f) : f, h = $b(m, n);
  return h ? /* @__PURE__ */ (0, y.jsx)("style", {
    "data-mantine-styles": !0,
    nonce: i?.(),
    dangerouslySetInnerHTML: { __html: `${h}${d ? "" : sT(n)}` }
  }) : null;
}
Yb.displayName = "@mantine/CssVariables";
function cT({ respectReducedMotion: n, getRootElement: o }) {
  Ua(() => {
    n && o()?.setAttribute("data-respect-reduced-motion", "true");
  }, [n]);
}
function qb({ theme: n, children: o, getStyleNonce: r, withStaticClasses: i = !0, withGlobalClasses: c = !0, deduplicateCssVariables: f = !0, withCssVariables: d = !0, cssVariablesSelector: m, classNamesPrefix: h = "mantine", colorSchemeManager: g = HE(), defaultColorScheme: w = "light", getRootElement: b = () => document.documentElement, cssVariablesResolver: v, forceColorScheme: x, stylesTransform: E, env: C, deduplicateInlineStyles: _ = !1 }) {
  const { colorScheme: R, setColorScheme: M, clearColorScheme: A } = JE({
    defaultColorScheme: w,
    forceColorScheme: x,
    manager: g,
    getRootElement: b
  });
  return cT({
    respectReducedMotion: n?.respectReducedMotion || !1,
    getRootElement: b
  }), /* @__PURE__ */ (0, y.jsx)(lh, {
    value: {
      colorScheme: R,
      setColorScheme: M,
      clearColorScheme: A,
      getRootElement: b,
      classNamesPrefix: h,
      getStyleNonce: r,
      cssVariablesResolver: v,
      cssVariablesSelector: m ?? ":root",
      withStaticClasses: i,
      stylesTransform: E,
      env: C,
      deduplicateInlineStyles: _
    },
    children: /* @__PURE__ */ (0, y.jsxs)(uh, {
      theme: n,
      children: [
        d && /* @__PURE__ */ (0, y.jsx)(Yb, {
          cssVariablesSelector: m,
          deduplicateCssVariables: f
        }),
        c && /* @__PURE__ */ (0, y.jsx)(lT, {}),
        o
      ]
    })
  });
}
qb.displayName = "@mantine/core/MantineProvider";
function uT({ children: n, theme: o, env: r }) {
  return /* @__PURE__ */ (0, y.jsx)(lh, {
    value: {
      colorScheme: "auto",
      setColorScheme: () => {
      },
      clearColorScheme: () => {
      },
      getRootElement: () => document.documentElement,
      classNamesPrefix: "mantine",
      cssVariablesSelector: ":root",
      withStaticClasses: !1,
      headless: !0,
      env: r
    },
    children: /* @__PURE__ */ (0, y.jsx)(uh, {
      theme: o,
      children: n
    })
  });
}
uT.displayName = "@mantine/core/HeadlessMantineProvider";
function pe(n, o, r) {
  const i = Bn(), c = (Array.isArray(n) ? n : [n]).filter(Boolean);
  let f = {};
  for (const d of c) {
    const m = i.components[d]?.defaultProps, h = typeof m == "function" ? m(i) : m;
    h && (f = {
      ...f,
      ...h
    });
  }
  return {
    ...o,
    ...f,
    ...Fm(r)
  };
}
function ki({ classNames: n, styles: o, props: r, stylesCtx: i }) {
  const c = Bn();
  return {
    resolvedClassNames: n === void 0 ? void 0 : Ai({
      theme: c,
      classNames: n,
      props: r,
      stylesCtx: i || void 0
    }),
    resolvedStyles: o === void 0 ? void 0 : Vc({
      theme: c,
      styles: o,
      props: r,
      stylesCtx: i || void 0
    })
  };
}
var fT = {
  always: "mantine-focus-always",
  auto: "mantine-focus-auto",
  never: "mantine-focus-never"
};
function dT({ theme: n, options: o, unstyled: r }) {
  return kt(o?.focusable && !r && (n.focusClassName || fT[n.focusRing]), o?.active && !r && n.activeClassName);
}
function mT({ selector: n, stylesCtx: o, options: r, props: i, theme: c }) {
  return Ai({
    theme: c,
    classNames: r?.classNames,
    props: r?.props || i,
    stylesCtx: o
  })[n];
}
function hT({ selector: n, stylesCtx: o, theme: r, classNames: i, props: c }) {
  return Ai({
    theme: r,
    classNames: i,
    props: c,
    stylesCtx: o
  })[n];
}
function vT({ rootSelector: n, selector: o, className: r }) {
  return n === o ? r : void 0;
}
function pT({ selector: n, classes: o, unstyled: r }) {
  return r ? void 0 : o[n];
}
function gT({ themeName: n, classNamesPrefix: o, selector: r, withStaticClass: i }) {
  return i === !1 ? [] : n.map((c) => `${o}-${c}-${r}`);
}
function yT({ options: n, classes: o, selector: r, unstyled: i }) {
  return n?.variant && !i ? o[`${r}--${n.variant}`] : void 0;
}
function bT({ theme: n, options: o, themeName: r, selector: i, classNamesPrefix: c, resolvedClassNames: f, resolvedThemeClassNames: d, classes: m, unstyled: h, className: g, rootSelector: w, props: b, stylesCtx: v, withStaticClasses: x, headless: E, transformedStyles: C }) {
  return kt(dT({
    theme: n,
    options: o,
    unstyled: h || E
  }), d.map((_) => _[i]), yT({
    options: o,
    classes: m,
    selector: i,
    unstyled: h || E
  }), f[i], hT({
    selector: i,
    stylesCtx: v,
    theme: n,
    classNames: C,
    props: b
  }), mT({
    selector: i,
    stylesCtx: v,
    options: o,
    props: b,
    theme: n
  }), vT({
    rootSelector: w,
    selector: i,
    className: g
  }), pT({
    selector: i,
    classes: m,
    unstyled: h || E
  }), x && !E && gT({
    themeName: r,
    classNamesPrefix: c,
    selector: i,
    withStaticClass: o?.withStaticClass
  }), o?.className);
}
function fh({ style: n, theme: o }) {
  return Array.isArray(n) ? n.reduce((r, i) => ({
    ...r,
    ...fh({
      style: i,
      theme: o
    })
  }), {}) : typeof n == "function" ? n(o) : n ?? {};
}
function ST({ theme: n, selector: o, options: r, props: i, stylesCtx: c, rootSelector: f, withStylesTransform: d, resolvedStyles: m, resolvedThemeStyles: h, resolvedVars: g, resolvedRootStyle: w }) {
  return {
    ...h[o],
    ...m[o],
    ...!d && Vc({
      theme: n,
      styles: r?.styles,
      props: r?.props || i,
      stylesCtx: c
    })[o],
    ...g[o],
    ...f === o ? w : null,
    ...fh({
      style: r?.style,
      theme: n
    })
  };
}
function xT(n) {
  return n.reduce((o, r) => (r && Object.keys(r).forEach((i) => {
    o[i] = {
      ...o[i],
      ...Fm(r[i])
    };
  }), o), {});
}
function wT({ props: n, stylesCtx: o, themeName: r, theme: i }) {
  const c = KE()?.();
  return {
    getTransformedStyles: (d) => c ? [...d.map((m) => c(m, {
      props: n,
      theme: i,
      ctx: o
    })), ...r.map((m) => c(i.components[m]?.styles, {
      props: n,
      theme: i,
      ctx: o
    }))].filter(Boolean) : [],
    withStylesTransform: !!c
  };
}
function Me({ name: n, classes: o, props: r, stylesCtx: i, className: c, style: f, rootSelector: d = "root", unstyled: m, classNames: h, styles: g, vars: w, varsResolver: b, attributes: v }) {
  const x = Bn(), E = XE(), C = IE(), _ = QE(), R = (Array.isArray(n) ? n : [n]).filter((J) => J), { withStylesTransform: M, getTransformedStyles: A } = wT({
    props: r,
    stylesCtx: i,
    themeName: R,
    theme: x
  }), O = Ai({
    theme: x,
    classNames: h,
    props: r,
    stylesCtx: i
  }), D = R.map((J) => Ai({
    theme: x,
    classNames: x.components[J]?.classNames,
    props: r,
    stylesCtx: i
  })), j = M ? {} : Vc({
    theme: x,
    styles: g,
    props: r,
    stylesCtx: i
  }), $ = {};
  if (!M) for (const J of R) {
    const W = Vc({
      theme: x,
      styles: x.components[J]?.styles,
      props: r,
      stylesCtx: i
    });
    for (const ie of Object.keys(W)) $[ie] = {
      ...$[ie],
      ...W[ie]
    };
  }
  const H = xT([
    _ ? {} : b?.(x, r, i),
    ...R.map((J) => x.components?.[J]?.vars?.(x, r, i)),
    w?.(x, r, i)
  ]), X = fh({
    style: f,
    theme: x
  });
  return (J, W) => ({
    ...v?.[J],
    className: bT({
      theme: x,
      options: W,
      themeName: R,
      selector: J,
      classNamesPrefix: E,
      resolvedClassNames: O,
      resolvedThemeClassNames: D,
      classes: o,
      unstyled: m,
      className: c,
      rootSelector: d,
      props: r,
      stylesCtx: i,
      withStaticClasses: C,
      headless: _,
      transformedStyles: A([W?.styles, g])
    }),
    style: ST({
      theme: x,
      selector: J,
      options: W,
      props: r,
      stylesCtx: i,
      rootSelector: d,
      withStylesTransform: M,
      resolvedStyles: j,
      resolvedThemeStyles: $,
      resolvedVars: H,
      resolvedRootStyle: X
    })
  });
}
function Ei(n) {
  return fa(n).reduce((o, r) => n[r] !== void 0 ? `${o}${nE(r)}:${n[r]};` : o, "").trim();
}
function CT({ selector: n, styles: o, media: r, container: i }) {
  const c = o ? Ei(o) : "", f = Array.isArray(r) ? r.map((m) => `@media${m.query}{${n}{${Ei(m.styles)}}}`) : [], d = Array.isArray(i) ? i.map((m) => `@container ${m.query}{${n}{${Ei(m.styles)}}}`) : [];
  return `${c ? `${n}{${c}}` : ""}${f.join("")}${d.join("")}`.trim();
}
function ET(n) {
  let o = 5381;
  for (let r = 0; r < n.length; r++) o = (o << 5) + o + n.charCodeAt(r) & 4294967295;
  return (o >>> 0).toString(36);
}
function TT({ deduplicate: n, ...o }) {
  const r = rh(), i = CT(o);
  return n ? /* @__PURE__ */ (0, y.jsx)("style", {
    href: `mantine-${ET(i)}`,
    precedence: "mantine",
    nonce: r?.(),
    children: i
  }) : /* @__PURE__ */ (0, y.jsx)("style", {
    "data-mantine-styles": "inline",
    nonce: r?.(),
    dangerouslySetInnerHTML: { __html: i }
  });
}
function _T(n) {
  let o = 5381;
  for (let r = 0; r < n.length; r++) o = (o << 5) + o + n.charCodeAt(r) & 4294967295;
  return (o >>> 0).toString(36);
}
function RT(n, o) {
  return `__mdi__-${_T(`${n ? Ei(n) : ""}|${Array.isArray(o) ? o.map((r) => `${r.query}:${Ei(r.styles)}`).join("|") : ""}`)}`;
}
function yr(n) {
  const { m: o, mx: r, my: i, mt: c, mb: f, ml: d, mr: m, me: h, ms: g, mis: w, mie: b, p: v, px: x, py: E, pt: C, pb: _, pl: R, pr: M, pe: A, ps: O, pis: D, pie: j, bd: $, bdrs: H, bg: X, c: J, opacity: W, ff: ie, fz: ae, fw: q, lts: me, ta: B, lh: G, fs: k, tt: I, td: ee, w: te, miw: ne, maw: ce, h: fe, mih: N, mah: Z, bgsz: ue, bgp: re, bgr: ge, bga: he, pos: ye, top: ve, left: de, bottom: Ne, right: Q, inset: Se, display: _e, flex: Ae, hiddenFrom: Oe, visibleFrom: We, lightHidden: ct, darkHidden: tt, sx: xt, ...Ye } = n;
  return {
    styleProps: Fm({
      m: o,
      mx: r,
      my: i,
      mt: c,
      mb: f,
      ml: d,
      mr: m,
      me: h,
      ms: g,
      mis: w,
      mie: b,
      p: v,
      px: x,
      py: E,
      pt: C,
      pb: _,
      pl: R,
      pr: M,
      pis: D,
      pie: j,
      pe: A,
      ps: O,
      bd: $,
      bg: X,
      c: J,
      opacity: W,
      ff: ie,
      fz: ae,
      fw: q,
      lts: me,
      ta: B,
      lh: G,
      fs: k,
      tt: I,
      td: ee,
      w: te,
      miw: ne,
      maw: ce,
      h: fe,
      mih: N,
      mah: Z,
      bgsz: ue,
      bgp: re,
      bgr: ge,
      bga: he,
      pos: ye,
      top: ve,
      left: de,
      bottom: Ne,
      right: Q,
      inset: Se,
      display: _e,
      flex: Ae,
      bdrs: H,
      hiddenFrom: Oe,
      visibleFrom: We,
      lightHidden: ct,
      darkHidden: tt,
      sx: xt
    }),
    rest: Ye
  };
}
var AT = {
  m: {
    type: "spacing",
    property: "margin"
  },
  mt: {
    type: "spacing",
    property: "marginTop"
  },
  mb: {
    type: "spacing",
    property: "marginBottom"
  },
  ml: {
    type: "spacing",
    property: "marginLeft"
  },
  mr: {
    type: "spacing",
    property: "marginRight"
  },
  ms: {
    type: "spacing",
    property: "marginInlineStart"
  },
  me: {
    type: "spacing",
    property: "marginInlineEnd"
  },
  mis: {
    type: "spacing",
    property: "marginInlineStart"
  },
  mie: {
    type: "spacing",
    property: "marginInlineEnd"
  },
  mx: {
    type: "spacing",
    property: "marginInline"
  },
  my: {
    type: "spacing",
    property: "marginBlock"
  },
  p: {
    type: "spacing",
    property: "padding"
  },
  pt: {
    type: "spacing",
    property: "paddingTop"
  },
  pb: {
    type: "spacing",
    property: "paddingBottom"
  },
  pl: {
    type: "spacing",
    property: "paddingLeft"
  },
  pr: {
    type: "spacing",
    property: "paddingRight"
  },
  ps: {
    type: "spacing",
    property: "paddingInlineStart"
  },
  pe: {
    type: "spacing",
    property: "paddingInlineEnd"
  },
  pis: {
    type: "spacing",
    property: "paddingInlineStart"
  },
  pie: {
    type: "spacing",
    property: "paddingInlineEnd"
  },
  px: {
    type: "spacing",
    property: "paddingInline"
  },
  py: {
    type: "spacing",
    property: "paddingBlock"
  },
  bd: {
    type: "border",
    property: "border"
  },
  bdrs: {
    type: "radius",
    property: "borderRadius"
  },
  bg: {
    type: "color",
    property: "background"
  },
  c: {
    type: "textColor",
    property: "color"
  },
  opacity: {
    type: "identity",
    property: "opacity"
  },
  ff: {
    type: "fontFamily",
    property: "fontFamily"
  },
  fz: {
    type: "fontSize",
    property: "fontSize"
  },
  fw: {
    type: "identity",
    property: "fontWeight"
  },
  lts: {
    type: "size",
    property: "letterSpacing"
  },
  ta: {
    type: "identity",
    property: "textAlign"
  },
  lh: {
    type: "lineHeight",
    property: "lineHeight"
  },
  fs: {
    type: "identity",
    property: "fontStyle"
  },
  tt: {
    type: "identity",
    property: "textTransform"
  },
  td: {
    type: "identity",
    property: "textDecoration"
  },
  w: {
    type: "spacing",
    property: "width"
  },
  miw: {
    type: "spacing",
    property: "minWidth"
  },
  maw: {
    type: "spacing",
    property: "maxWidth"
  },
  h: {
    type: "spacing",
    property: "height"
  },
  mih: {
    type: "spacing",
    property: "minHeight"
  },
  mah: {
    type: "spacing",
    property: "maxHeight"
  },
  bgsz: {
    type: "size",
    property: "backgroundSize"
  },
  bgp: {
    type: "identity",
    property: "backgroundPosition"
  },
  bgr: {
    type: "identity",
    property: "backgroundRepeat"
  },
  bga: {
    type: "identity",
    property: "backgroundAttachment"
  },
  pos: {
    type: "identity",
    property: "position"
  },
  top: {
    type: "size",
    property: "top"
  },
  left: {
    type: "size",
    property: "left"
  },
  bottom: {
    type: "size",
    property: "bottom"
  },
  right: {
    type: "size",
    property: "right"
  },
  inset: {
    type: "size",
    property: "inset"
  },
  display: {
    type: "identity",
    property: "display"
  },
  flex: {
    type: "identity",
    property: "flex"
  }
};
function dh(n, o) {
  const r = pa({
    color: n,
    theme: o
  });
  return r.color === "dimmed" ? "var(--mantine-color-dimmed)" : r.color === "bright" ? "var(--mantine-color-bright)" : r.variable ? `var(${r.variable})` : r.color;
}
function NT(n, o) {
  const r = pa({
    color: n,
    theme: o
  });
  return r.isThemeColor && r.shade === void 0 ? `var(--mantine-color-${r.color}-text)` : dh(n, o);
}
function OT(n, o) {
  if (typeof n == "number") return se(n);
  if (typeof n == "string") {
    const [r, i, ...c] = n.split(" ").filter((d) => d.trim() !== "");
    let f = `${se(r)}`;
    return i && (f += ` ${i}`), c.length > 0 && (f += ` ${dh(c.join(" "), o)}`), f.trim();
  }
  return n;
}
var Ly = {
  text: "var(--mantine-font-family)",
  mono: "var(--mantine-font-family-monospace)",
  monospace: "var(--mantine-font-family-monospace)",
  heading: "var(--mantine-font-family-headings)",
  headings: "var(--mantine-font-family-headings)"
};
function MT(n) {
  return typeof n == "string" && n in Ly ? Ly[n] : n;
}
var zT = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
];
function jT(n, o) {
  return typeof n == "string" && n in o.fontSizes ? `var(--mantine-font-size-${n})` : typeof n == "string" && zT.includes(n) ? `var(--mantine-${n}-font-size)` : typeof n == "number" || typeof n == "string" ? se(n) : n;
}
function DT(n) {
  return n;
}
var LT = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
];
function BT(n, o) {
  return typeof n == "string" && n in o.lineHeights ? `var(--mantine-line-height-${n})` : typeof n == "string" && LT.includes(n) ? `var(--mantine-${n}-line-height)` : n;
}
function HT(n, o) {
  return typeof n == "string" && n in o.radius ? `var(--mantine-radius-${n})` : typeof n == "number" || typeof n == "string" ? se(n) : n;
}
function kT(n) {
  return typeof n == "number" ? se(n) : n;
}
function UT(n, o) {
  if (typeof n == "number") return se(n);
  if (typeof n == "string") {
    const r = n.replace("-", "");
    if (!(r in o.spacing)) return se(n);
    const i = `--mantine-spacing-${r}`;
    return n.startsWith("-") ? `calc(var(${i}) * -1)` : `var(${i})`;
  }
  return n;
}
var sm = {
  color: dh,
  textColor: NT,
  fontSize: jT,
  spacing: UT,
  radius: HT,
  identity: DT,
  size: kT,
  lineHeight: BT,
  fontFamily: MT,
  border: OT
};
function By(n) {
  return n.replace("(min-width: ", "").replace("em)", "");
}
function $T({ media: n, ...o }) {
  const r = Object.keys(n).sort((i, c) => Number(By(i)) - Number(By(c))).map((i) => ({
    query: i,
    styles: n[i]
  }));
  return {
    ...o,
    media: r
  };
}
function VT(n) {
  if (typeof n != "object" || n === null) return !1;
  const o = Object.keys(n);
  return !(o.length === 1 && o[0] === "base");
}
function YT(n) {
  return typeof n == "object" && n !== null ? "base" in n ? n.base : void 0 : n;
}
function qT(n) {
  return typeof n == "object" && n !== null ? fa(n).filter((o) => o !== "base") : [];
}
function GT(n, o) {
  return typeof n == "object" && n !== null && o in n ? n[o] : n;
}
function PT({ styleProps: n, data: o, theme: r }) {
  return $T(fa(n).reduce((i, c) => {
    if (c === "hiddenFrom" || c === "visibleFrom" || c === "sx") return i;
    const f = o[c], d = Array.isArray(f.property) ? f.property : [f.property], m = YT(n[c]);
    if (!VT(n[c]))
      return d.forEach((g) => {
        i.inlineStyles[g] = sm[f.type](m, r);
      }), i;
    i.hasResponsiveStyles = !0;
    const h = qT(n[c]);
    return d.forEach((g) => {
      m != null && (i.styles[g] = sm[f.type](m, r)), h.forEach((w) => {
        const b = `(min-width: ${r.breakpoints[w]})`;
        i.media[b] = {
          ...i.media[b],
          [g]: sm[f.type](GT(n[c], w), r)
        };
      });
    }), i;
  }, {
    hasResponsiveStyles: !1,
    styles: {},
    inlineStyles: {},
    media: {}
  }));
}
function XT() {
  return `__m__-${(0, S.useId)().replace(/[:«»]/g, "")}`;
}
function Gb(n, o) {
  return Array.isArray(n) ? [...n].reduce((r, i) => ({
    ...r,
    ...Gb(i, o)
  }), {}) : typeof n == "function" ? n(o) : n ?? {};
}
function IT(n) {
  return n;
}
var QT = IT;
function Pb(n) {
  return n;
}
function Ee(n) {
  const o = n;
  return o.extend = Pb, o.withProps = (r) => {
    const i = (c) => /* @__PURE__ */ (0, y.jsx)(o, {
      ...r,
      ...c
    });
    return i.extend = o.extend, i.displayName = `WithProps(${o.displayName})`, i;
  }, o;
}
function Kc(n) {
  return Ee(n);
}
function Sn(n) {
  const o = n;
  return o.withProps = (r) => {
    const i = (c) => /* @__PURE__ */ (0, y.jsx)(o, {
      ...r,
      ...c
    });
    return i.extend = o.extend, i.displayName = `WithProps(${o.displayName})`, i;
  }, o.extend = Pb, o;
}
function Xb(n) {
  return `data-${(n.startsWith("data-") ? n.slice(5) : n).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
}
function ZT(n) {
  return Object.keys(n).reduce((o, r) => {
    const i = n[r];
    return i === void 0 || i === "" || i === !1 || i === null || (o[Xb(r)] = n[r]), o;
  }, {});
}
function Ib(n) {
  return n ? typeof n == "string" ? { [Xb(n)]: !0 } : Array.isArray(n) ? [...n].reduce((o, r) => ({
    ...o,
    ...Ib(r)
  }), {}) : ZT(n) : null;
}
function Mm(n, o) {
  return Array.isArray(n) ? [...n].reduce((r, i) => ({
    ...r,
    ...Mm(i, o)
  }), {}) : typeof n == "function" ? n(o) : n ?? {};
}
function KT({ theme: n, style: o, vars: r, styleProps: i }) {
  const c = Mm(o, n), f = Mm(r, n);
  return {
    ...c,
    ...f,
    ...i
  };
}
function Qb({ component: n, style: o, __vars: r, className: i, variant: c, mod: f, size: d, hiddenFrom: m, visibleFrom: h, lightHidden: g, darkHidden: w, renderRoot: b, __size: v, ref: x, ...E }) {
  const C = Bn(), _ = n || "div", { styleProps: R, rest: M } = yr(E), A = ZE()?.()?.(R.sx), O = XT(), D = PT({
    styleProps: R,
    theme: C,
    data: AT
  }), j = FE(), $ = j && D.hasResponsiveStyles ? RT(D.styles, D.media) : O, H = {
    ref: x,
    style: KT({
      theme: C,
      style: o,
      vars: r,
      styleProps: D.inlineStyles
    }),
    className: kt(i, A, {
      [$]: D.hasResponsiveStyles,
      "mantine-light-hidden": g,
      "mantine-dark-hidden": w,
      [`mantine-hidden-from-${m}`]: m,
      [`mantine-visible-from-${h}`]: h
    }),
    "data-variant": c,
    "data-size": Mb(d) ? void 0 : d || void 0,
    size: v,
    ...Ib(f),
    ...M
  };
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [D.hasResponsiveStyles && /* @__PURE__ */ (0, y.jsx)(TT, {
    selector: `.${$}`,
    styles: D.styles,
    media: D.media,
    deduplicate: j
  }), typeof b == "function" ? b(H) : /* @__PURE__ */ (0, y.jsx)(_, { ...H })] });
}
Qb.displayName = "@mantine/core/Box";
var xe = QT(Qb), FT = (0, S.createContext)({
  dir: "ltr",
  toggleDirection: () => {
  },
  setDirection: () => {
  }
});
function Pa() {
  return (0, S.use)(FT);
}
var [JT, Hn] = Do("ScrollArea.Root component was not found in tree");
function Mo(n, o) {
  const r = (0, S.useEffectEvent)(o);
  Ua(() => {
    let i = 0;
    if (n) {
      const c = new ResizeObserver(() => {
        cancelAnimationFrame(i), i = window.requestAnimationFrame(r);
      });
      return c.observe(n), () => {
        window.cancelAnimationFrame(i), c.unobserve(n);
      };
    }
  }, [n]);
}
function WT(n) {
  const { style: o, ...r } = n, i = Hn(), [c, f] = (0, S.useState)(0), [d, m] = (0, S.useState)(0), h = !!(c && d);
  return Mo(i.scrollbarX, () => {
    const g = i.scrollbarX?.offsetHeight || 0;
    i.onCornerHeightChange(g), m(g);
  }), Mo(i.scrollbarY, () => {
    const g = i.scrollbarY?.offsetWidth || 0;
    i.onCornerWidthChange(g), f(g);
  }), h ? /* @__PURE__ */ (0, y.jsx)("div", {
    ...r,
    style: {
      ...o,
      width: c,
      height: d
    }
  }) : null;
}
function e_(n) {
  const o = Hn(), r = !!(o.scrollbarX && o.scrollbarY);
  return o.type !== "scroll" && r ? /* @__PURE__ */ (0, y.jsx)(WT, { ...n }) : null;
}
var t_ = {
  scrollHideDelay: 1e3,
  type: "hover"
};
function Zb(n) {
  const { type: o, scrollHideDelay: r, scrollbars: i, getStyles: c, ref: f, ...d } = pe("ScrollAreaRoot", t_, n), [m, h] = (0, S.useState)(null), [g, w] = (0, S.useState)(null), [b, v] = (0, S.useState)(null), [x, E] = (0, S.useState)(null), [C, _] = (0, S.useState)(null), [R, M] = (0, S.useState)(0), [A, O] = (0, S.useState)(0), [D, j] = (0, S.useState)(!1), [$, H] = (0, S.useState)(!1), X = st(f, h);
  return /* @__PURE__ */ (0, y.jsx)(JT, {
    value: {
      type: o,
      scrollHideDelay: r,
      scrollArea: m,
      viewport: g,
      onViewportChange: w,
      content: b,
      onContentChange: v,
      scrollbarX: x,
      onScrollbarXChange: E,
      scrollbarXEnabled: D,
      onScrollbarXEnabledChange: j,
      scrollbarY: C,
      onScrollbarYChange: _,
      scrollbarYEnabled: $,
      onScrollbarYEnabledChange: H,
      onCornerWidthChange: M,
      onCornerHeightChange: O,
      getStyles: c
    },
    children: /* @__PURE__ */ (0, y.jsx)(xe, {
      ...d,
      ref: X,
      __vars: {
        "--sa-corner-width": i !== "xy" ? "0px" : `${R}px`,
        "--sa-corner-height": i !== "xy" ? "0px" : `${A}px`
      }
    })
  });
}
Zb.displayName = "@mantine/core/ScrollAreaRoot";
function Kb(n, o) {
  const r = n / o;
  return Number.isNaN(r) ? 0 : r;
}
function Fc(n) {
  const o = Kb(n.viewport, n.content), r = n.scrollbar.paddingStart + n.scrollbar.paddingEnd, i = (n.scrollbar.size - r) * o;
  return Math.max(i, 18);
}
function Fb(n, o) {
  return (r) => {
    if (n[0] === n[1] || o[0] === o[1]) return o[0];
    const i = (o[1] - o[0]) / (n[1] - n[0]);
    return o[0] + i * (r - n[0]);
  };
}
function n_(n, [o, r]) {
  return Math.min(r, Math.max(o, n));
}
function Hy(n, o, r = "ltr") {
  const i = Fc(o), c = o.scrollbar.paddingStart + o.scrollbar.paddingEnd, f = o.scrollbar.size - c, d = o.content - o.viewport, m = f - i, h = n_(n, r === "ltr" ? [0, d] : [d * -1, 0]);
  return Fb([0, d], [0, m])(h);
}
function a_(n, o, r, i = "ltr") {
  const c = Fc(r), f = c / 2, d = o || f, m = c - d, h = r.scrollbar.paddingStart + d, g = r.scrollbar.size - r.scrollbar.paddingEnd - m, w = r.content - r.viewport, b = i === "ltr" ? [0, w] : [w * -1, 0];
  return Fb([h, g], b)(n);
}
function Jb(n, o) {
  return n > 0 && n < o;
}
function _o(n) {
  return n ? parseInt(n, 10) : 0;
}
function ml(n, o, { checkForDefaultPrevented: r = !0 } = {}) {
  return (i) => {
    n?.(i), (r === !1 || !i.defaultPrevented) && o?.(i);
  };
}
var [o_, Wb] = Do("ScrollAreaScrollbar was not found in tree");
function e1(n) {
  const { sizes: o, hasThumb: r, onThumbChange: i, onThumbPointerUp: c, onThumbPointerDown: f, onThumbPositionChange: d, onDragScroll: m, onWheelScroll: h, onResize: g, ref: w, ...b } = n, v = Hn(), [x, E] = (0, S.useState)(null), C = st(w, E), _ = (0, S.useRef)(null), R = (0, S.useRef)(""), { viewport: M } = v, A = o.content - o.viewport, O = (0, S.useEffectEvent)(h), D = mr(d), j = Qc(g, 10), $ = (H) => {
    if (_.current) {
      const X = H.clientX - _.current.left, J = H.clientY - _.current.top;
      m({
        x: X,
        y: J
      });
    }
  };
  return (0, S.useEffect)(() => {
    const H = (X) => {
      const J = X.target;
      x?.contains(J) && O(X, A);
    };
    return document.addEventListener("wheel", H, { passive: !1 }), () => document.removeEventListener("wheel", H, { passive: !1 });
  }, [
    M,
    x,
    A
  ]), (0, S.useEffect)(D, [o, D]), Mo(x, j), Mo(v.content, j), /* @__PURE__ */ (0, y.jsx)(o_, {
    value: {
      scrollbar: x,
      hasThumb: r,
      onThumbChange: mr(i),
      onThumbPointerUp: mr(c),
      onThumbPositionChange: D,
      onThumbPointerDown: mr(f)
    },
    children: /* @__PURE__ */ (0, y.jsx)("div", {
      ...b,
      ref: C,
      "data-mantine-scrollbar": !0,
      style: {
        position: "absolute",
        ...b.style
      },
      onPointerDown: ml(n.onPointerDown, (H) => {
        H.preventDefault(), H.button === 0 && (H.target.setPointerCapture(H.pointerId), _.current = x.getBoundingClientRect(), R.current = document.body.style.webkitUserSelect, document.body.style.webkitUserSelect = "none", $(H));
      }),
      onPointerMove: ml(n.onPointerMove, $),
      onPointerUp: ml(n.onPointerUp, (H) => {
        const X = H.target;
        X.hasPointerCapture(H.pointerId) && (H.preventDefault(), X.releasePointerCapture(H.pointerId));
      }),
      onLostPointerCapture: () => {
        document.body.style.webkitUserSelect = R.current, _.current = null;
      }
    })
  });
}
var t1 = (n) => {
  const { sizes: o, onSizesChange: r, style: i, ref: c, ...f } = n, d = Hn(), [m, h] = (0, S.useState)(), g = (0, S.useRef)(null), w = st(c, g, d.onScrollbarXChange);
  return (0, S.useEffect)(() => {
    g.current && h(getComputedStyle(g.current));
  }, [g]), /* @__PURE__ */ (0, y.jsx)(e1, {
    "data-orientation": "horizontal",
    ...f,
    ref: w,
    sizes: o,
    style: {
      ...i,
      "--sa-thumb-width": `${Fc(o)}px`
    },
    onThumbPointerDown: (b) => n.onThumbPointerDown(b.x),
    onDragScroll: (b) => n.onDragScroll(b.x),
    onWheelScroll: (b, v) => {
      if (d.viewport) {
        const x = d.viewport.scrollLeft + b.deltaX;
        n.onWheelScroll(x), Jb(x, v) && b.preventDefault();
      }
    },
    onResize: () => {
      g.current && d.viewport && m && r({
        content: d.viewport.scrollWidth,
        viewport: d.viewport.offsetWidth,
        scrollbar: {
          size: g.current.clientWidth,
          paddingStart: _o(m.paddingLeft),
          paddingEnd: _o(m.paddingRight)
        }
      });
    }
  });
};
t1.displayName = "@mantine/core/ScrollAreaScrollbarX";
function n1(n) {
  const { sizes: o, onSizesChange: r, style: i, ref: c, ...f } = n, d = Hn(), [m, h] = (0, S.useState)(), g = (0, S.useRef)(null), w = st(c, g, d.onScrollbarYChange);
  return (0, S.useEffect)(() => {
    g.current && h(window.getComputedStyle(g.current));
  }, []), /* @__PURE__ */ (0, y.jsx)(e1, {
    ...f,
    "data-orientation": "vertical",
    ref: w,
    sizes: o,
    style: {
      "--sa-thumb-height": `${Fc(o)}px`,
      ...i
    },
    onThumbPointerDown: (b) => n.onThumbPointerDown(b.y),
    onDragScroll: (b) => n.onDragScroll(b.y),
    onWheelScroll: (b, v) => {
      if (d.viewport) {
        const x = d.viewport.scrollTop + b.deltaY;
        n.onWheelScroll(x), Jb(x, v) && b.preventDefault();
      }
    },
    onResize: () => {
      g.current && d.viewport && m && r({
        content: d.viewport.scrollHeight,
        viewport: d.viewport.offsetHeight,
        scrollbar: {
          size: g.current.clientHeight,
          paddingStart: _o(m.paddingTop),
          paddingEnd: _o(m.paddingBottom)
        }
      });
    }
  });
}
n1.displayName = "@mantine/core/ScrollAreaScrollbarY";
function Jc(n) {
  const { orientation: o = "vertical", ...r } = n, { dir: i } = Pa(), c = Hn(), f = (0, S.useRef)(null), d = (0, S.useRef)(0), [m, h] = (0, S.useState)({
    content: 0,
    viewport: 0,
    scrollbar: {
      size: 0,
      paddingStart: 0,
      paddingEnd: 0
    }
  }), g = Kb(m.viewport, m.content), w = {
    ...r,
    sizes: m,
    onSizesChange: h,
    hasThumb: g > 0 && g < 1,
    onThumbChange: (v) => {
      f.current = v;
    },
    onThumbPointerUp: () => {
      d.current = 0;
    },
    onThumbPointerDown: (v) => {
      d.current = v;
    }
  }, b = (v, x) => a_(v, d.current, m, x);
  return o === "horizontal" ? /* @__PURE__ */ (0, y.jsx)(t1, {
    ...w,
    onThumbPositionChange: () => {
      if (c.viewport && f.current) {
        const v = c.viewport.scrollLeft, x = Hy(v, m, i);
        f.current.style.transform = `translate3d(${x}px, 0, 0)`;
      }
    },
    onWheelScroll: (v) => {
      c.viewport && (c.viewport.scrollLeft = v);
    },
    onDragScroll: (v) => {
      c.viewport && (c.viewport.scrollLeft = b(v, i));
    }
  }) : o === "vertical" ? /* @__PURE__ */ (0, y.jsx)(n1, {
    ...w,
    onThumbPositionChange: () => {
      if (c.viewport && f.current) {
        const v = c.viewport.scrollTop, x = Hy(v, m);
        m.scrollbar.size === 0 ? f.current.style.setProperty("--thumb-opacity", "0") : f.current.style.setProperty("--thumb-opacity", "1"), f.current.style.transform = `translate3d(0, ${x}px, 0)`;
      }
    },
    onWheelScroll: (v) => {
      c.viewport && (c.viewport.scrollTop = v);
    },
    onDragScroll: (v) => {
      c.viewport && (c.viewport.scrollTop = b(v));
    }
  }) : null;
}
Jc.displayName = "@mantine/core/ScrollAreaScrollbarVisible";
function mh(n) {
  const o = Hn(), { forceMount: r, ...i } = n, [c, f] = (0, S.useState)(!1), d = n.orientation === "horizontal", m = Qc(() => {
    if (o.viewport) {
      const h = o.viewport.offsetWidth < o.viewport.scrollWidth, g = o.viewport.offsetHeight < o.viewport.scrollHeight;
      f(d ? h : g);
    }
  }, 10);
  return Mo(o.viewport, m), Mo(o.content, m), r || c ? /* @__PURE__ */ (0, y.jsx)(Jc, {
    "data-state": c ? "visible" : "hidden",
    ...i
  }) : null;
}
mh.displayName = "@mantine/core/ScrollAreaScrollbarAuto";
function a1(n) {
  const { forceMount: o, ...r } = n, i = Hn(), [c, f] = (0, S.useState)(!1);
  return (0, S.useEffect)(() => {
    const { scrollArea: d } = i;
    let m = 0;
    if (d) {
      const h = () => {
        window.clearTimeout(m), f(!0);
      }, g = () => {
        m = window.setTimeout(() => f(!1), i.scrollHideDelay);
      };
      return d.addEventListener("pointerenter", h), d.addEventListener("pointerleave", g), () => {
        window.clearTimeout(m), d.removeEventListener("pointerenter", h), d.removeEventListener("pointerleave", g);
      };
    }
  }, [i.scrollArea, i.scrollHideDelay]), o || c ? /* @__PURE__ */ (0, y.jsx)(mh, {
    "data-state": c ? "visible" : "hidden",
    ...r
  }) : null;
}
a1.displayName = "@mantine/core/ScrollAreaScrollbarHover";
function l_(n) {
  const { forceMount: o, ...r } = n, i = Hn(), c = n.orientation === "horizontal", [f, d] = (0, S.useState)("hidden"), m = Qc(() => d("idle"), 100);
  return (0, S.useEffect)(() => {
    if (f === "idle") {
      const h = window.setTimeout(() => d("hidden"), i.scrollHideDelay);
      return () => window.clearTimeout(h);
    }
  }, [f, i.scrollHideDelay]), (0, S.useEffect)(() => {
    const { viewport: h } = i, g = c ? "scrollLeft" : "scrollTop";
    if (h) {
      let w = h[g];
      const b = () => {
        const v = h[g];
        w !== v && (d("scrolling"), m()), w = v;
      };
      return h.addEventListener("scroll", b), () => h.removeEventListener("scroll", b);
    }
  }, [
    i.viewport,
    c,
    m
  ]), o || f !== "hidden" ? /* @__PURE__ */ (0, y.jsx)(Jc, {
    "data-state": f === "hidden" ? "hidden" : "visible",
    ...r,
    onPointerEnter: ml(n.onPointerEnter, () => d("interacting")),
    onPointerLeave: ml(n.onPointerLeave, () => d("idle"))
  }) : null;
}
function zm(n) {
  const { forceMount: o, ...r } = n, i = Hn(), { onScrollbarXEnabledChange: c, onScrollbarYEnabledChange: f } = i, d = n.orientation === "horizontal";
  return (0, S.useEffect)(() => (d ? c(!0) : f(!0), () => {
    d ? c(!1) : f(!1);
  }), [
    d,
    c,
    f
  ]), i.type === "hover" ? /* @__PURE__ */ (0, y.jsx)(a1, {
    ...r,
    forceMount: o
  }) : i.type === "scroll" ? /* @__PURE__ */ (0, y.jsx)(l_, {
    ...r,
    forceMount: o
  }) : i.type === "auto" ? /* @__PURE__ */ (0, y.jsx)(mh, {
    ...r,
    forceMount: o
  }) : i.type === "always" ? /* @__PURE__ */ (0, y.jsx)(Jc, { ...r }) : null;
}
zm.displayName = "@mantine/core/ScrollAreaScrollbar";
function r_(n, o = () => {
}) {
  let r = {
    left: n.scrollLeft,
    top: n.scrollTop
  }, i = 0;
  return (function c() {
    const f = {
      left: n.scrollLeft,
      top: n.scrollTop
    }, d = r.left !== f.left, m = r.top !== f.top;
    (d || m) && o(), r = f, i = window.requestAnimationFrame(c);
  })(), () => window.cancelAnimationFrame(i);
}
function o1(n) {
  const { style: o, ref: r, ...i } = n, c = Hn(), f = Wb(), { onThumbPositionChange: d } = f, m = st(r, f.onThumbChange), h = (0, S.useRef)(void 0), g = Qc(() => {
    h.current && (h.current(), h.current = void 0);
  }, 100);
  return (0, S.useEffect)(() => {
    const { viewport: w } = c;
    if (w) {
      const b = () => {
        if (g(), !h.current) {
          const v = r_(w, d);
          h.current = v, d();
        }
      };
      return d(), w.addEventListener("scroll", b), () => w.removeEventListener("scroll", b);
    }
  }, [
    c.viewport,
    g,
    d
  ]), /* @__PURE__ */ (0, y.jsx)("div", {
    "data-state": f.hasThumb ? "visible" : "hidden",
    ...i,
    ref: m,
    style: {
      width: "var(--sa-thumb-width)",
      height: "var(--sa-thumb-height)",
      ...o
    },
    onPointerDownCapture: ml(n.onPointerDownCapture, (w) => {
      const b = w.target.getBoundingClientRect(), v = w.clientX - b.left, x = w.clientY - b.top;
      f.onThumbPointerDown({
        x: v,
        y: x
      });
    }),
    onPointerUp: ml(n.onPointerUp, f.onThumbPointerUp)
  });
}
o1.displayName = "@mantine/core/ScrollAreaThumb";
function jm(n) {
  const { forceMount: o, ...r } = n, i = Wb();
  return o || i.hasThumb ? /* @__PURE__ */ (0, y.jsx)(o1, { ...r }) : null;
}
jm.displayName = "@mantine/core/ScrollAreaThumb";
function l1({ children: n, style: o, ref: r, onWheel: i, ...c }) {
  const f = Hn(), d = st(r, f.onViewportChange), m = (h) => {
    if (i?.(h), f.scrollbarXEnabled && f.viewport && h.shiftKey) {
      const { scrollTop: g, scrollHeight: w, clientHeight: b, scrollWidth: v, clientWidth: x } = f.viewport, E = g < 1, C = g >= w - b - 1;
      v > x && (E || C) && h.stopPropagation();
    }
  };
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...c,
    ref: d,
    onWheel: m,
    "data-scrollarea-viewport": !0,
    style: {
      overflowX: f.scrollbarXEnabled ? "scroll" : "hidden",
      overflowY: f.scrollbarYEnabled ? "scroll" : "hidden",
      ...o
    },
    children: /* @__PURE__ */ (0, y.jsx)("div", {
      ...f.getStyles("content"),
      ref: f.onContentChange,
      children: n
    })
  });
}
l1.displayName = "@mantine/core/ScrollAreaViewport";
var hh = {
  root: "m_d57069b5",
  content: "m_b1336c6",
  viewport: "m_c0783ff9",
  viewportInner: "m_f8f631dd",
  scrollbar: "m_c44ba933",
  thumb: "m_d8b5e363",
  corner: "m_21657268"
};
function Wc() {
  return typeof window < "u";
}
function br(n) {
  return r1(n) ? (n.nodeName || "").toLowerCase() : "#document";
}
function Qt(n) {
  var o;
  return (n == null || (o = n.ownerDocument) == null ? void 0 : o.defaultView) || window;
}
function Xa(n) {
  var o;
  return (o = (r1(n) ? n.ownerDocument : n.document) || window.document) == null ? void 0 : o.documentElement;
}
function r1(n) {
  return Wc() ? n instanceof Node || n instanceof Qt(n).Node : !1;
}
function ot(n) {
  return Wc() ? n instanceof Element || n instanceof Qt(n).Element : !1;
}
function Kn(n) {
  return Wc() ? n instanceof HTMLElement || n instanceof Qt(n).HTMLElement : !1;
}
function Yc(n) {
  return !Wc() || typeof ShadowRoot > "u" ? !1 : n instanceof ShadowRoot || n instanceof Qt(n).ShadowRoot;
}
function eu(n) {
  const { overflow: o, overflowX: r, overflowY: i, display: c } = Qn(n);
  return /auto|scroll|overlay|hidden|clip/.test(o + i + r) && c !== "inline" && c !== "contents";
}
function i_(n) {
  return /^(table|td|th)$/.test(br(n));
}
function tu(n) {
  try {
    if (n.matches(":popover-open")) return !0;
  } catch {
  }
  try {
    return n.matches(":modal");
  } catch {
    return !1;
  }
}
var s_ = /transform|translate|scale|rotate|perspective|filter/, c_ = /paint|layout|strict|content/, sl = (n) => !!n && n !== "none", cm;
function vh(n) {
  const o = ot(n) ? Qn(n) : n;
  return sl(o.transform) || sl(o.translate) || sl(o.scale) || sl(o.rotate) || sl(o.perspective) || !nu() && (sl(o.backdropFilter) || sl(o.filter)) || s_.test(o.willChange || "") || c_.test(o.contain || "");
}
function u_(n) {
  let o = zo(n);
  for (; Kn(o) && !Ro(o); ) {
    if (vh(o)) return o;
    if (tu(o)) return null;
    o = zo(o);
  }
  return null;
}
function nu() {
  return cm == null && (cm = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), cm;
}
function Ro(n) {
  return /^(html|body|#document)$/.test(br(n));
}
function Qn(n) {
  return Qt(n).getComputedStyle(n);
}
function au(n) {
  return ot(n) ? {
    scrollLeft: n.scrollLeft,
    scrollTop: n.scrollTop
  } : {
    scrollLeft: n.scrollX,
    scrollTop: n.scrollY
  };
}
function zo(n) {
  if (br(n) === "html") return n;
  const o = n.assignedSlot || n.parentNode || Yc(n) && n.host || Xa(n);
  return Yc(o) ? o.host : o;
}
function i1(n) {
  const o = zo(n);
  return Ro(o) ? (n.ownerDocument || n).body : Kn(o) && eu(o) ? o : i1(o);
}
function Ba(n, o, r) {
  var i;
  o === void 0 && (o = []), r === void 0 && (r = !0);
  const c = i1(n), f = c === ((i = n.ownerDocument) == null ? void 0 : i.body), d = Qt(c);
  if (f) {
    const m = Dm(d);
    return o.concat(d, d.visualViewport || [], eu(c) ? c : [], m && r ? Ba(m) : []);
  } else return o.concat(c, Ba(c, [], r));
}
function Dm(n) {
  return n.parent && Object.getPrototypeOf(n.parent) ? n.frameElement : null;
}
var f_ = [
  "top",
  "right",
  "bottom",
  "left"
], Zn = Math.min, Ln = Math.max, qc = Math.round, _c = Math.floor, Ha = (n) => ({
  x: n,
  y: n
}), d_ = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function s1(n, o, r) {
  return Ln(n, Zn(o, r));
}
function ma(n, o) {
  return typeof n == "function" ? n(o) : n;
}
function ha(n) {
  return n.split("-")[0];
}
function Sr(n) {
  return n.split("-")[1];
}
function ph(n) {
  return n === "x" ? "y" : "x";
}
function gh(n) {
  return n === "y" ? "height" : "width";
}
function Xn(n) {
  const o = n[0];
  return o === "t" || o === "b" ? "y" : "x";
}
function yh(n) {
  return ph(Xn(n));
}
function m_(n, o, r) {
  r === void 0 && (r = !1);
  const i = Sr(n), c = yh(n), f = gh(c);
  let d = c === "x" ? i === (r ? "end" : "start") ? "right" : "left" : i === "start" ? "bottom" : "top";
  return o.reference[f] > o.floating[f] && (d = Gc(d)), [d, Gc(d)];
}
function h_(n) {
  const o = Gc(n);
  return [
    Lm(n),
    o,
    Lm(o)
  ];
}
function Lm(n) {
  return n.includes("start") ? n.replace("start", "end") : n.replace("end", "start");
}
var ky = ["left", "right"], Uy = ["right", "left"], v_ = ["top", "bottom"], p_ = ["bottom", "top"];
function g_(n, o, r) {
  switch (n) {
    case "top":
    case "bottom":
      return r ? o ? Uy : ky : o ? ky : Uy;
    case "left":
    case "right":
      return o ? v_ : p_;
    default:
      return [];
  }
}
function y_(n, o, r, i) {
  const c = Sr(n);
  let f = g_(ha(n), r === "start", i);
  return c && (f = f.map((d) => d + "-" + c), o && (f = f.concat(f.map(Lm)))), f;
}
function Gc(n) {
  const o = ha(n);
  return d_[o] + n.slice(o.length);
}
function b_(n) {
  var o, r, i, c;
  return {
    top: (o = n.top) != null ? o : 0,
    right: (r = n.right) != null ? r : 0,
    bottom: (i = n.bottom) != null ? i : 0,
    left: (c = n.left) != null ? c : 0
  };
}
function bh(n) {
  return typeof n != "number" ? b_(n) : {
    top: n,
    right: n,
    bottom: n,
    left: n
  };
}
function Ao(n) {
  const { x: o, y: r, width: i, height: c } = n;
  return {
    width: i,
    height: c,
    top: r,
    left: o,
    right: o + i,
    bottom: r + c,
    x: o,
    y: r
  };
}
function S_() {
  const n = navigator.userAgentData;
  return n != null && n.platform ? n.platform : navigator.platform;
}
function x_() {
  const n = navigator.userAgentData;
  return n && Array.isArray(n.brands) ? n.brands.map((o) => {
    let { brand: r, version: i } = o;
    return r + "/" + i;
  }).join(" ") : navigator.userAgent;
}
function w_() {
  return /apple/i.test(navigator.vendor);
}
function C_() {
  return S_().toLowerCase().startsWith("mac") && !navigator.maxTouchPoints;
}
function E_() {
  return x_().includes("jsdom/");
}
var $y = "data-floating-ui-focusable", T_ = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";
function Vy(n) {
  let o = n.activeElement;
  for (; ((r = o) == null || (r = r.shadowRoot) == null ? void 0 : r.activeElement) != null; ) {
    var r;
    o = o.shadowRoot.activeElement;
  }
  return o;
}
function Oi(n, o) {
  if (!n || !o) return !1;
  const r = o.getRootNode == null ? void 0 : o.getRootNode();
  if (n.contains(o)) return !0;
  if (r && Yc(r)) {
    let i = o;
    for (; i; ) {
      if (n === i) return !0;
      i = i.parentNode || i.host;
    }
  }
  return !1;
}
function dr(n) {
  return "composedPath" in n ? n.composedPath()[0] : n.target;
}
function um(n, o) {
  if (o == null) return !1;
  if ("composedPath" in n) return n.composedPath().includes(o);
  const r = n;
  return r.target != null && o.contains(r.target);
}
function __(n) {
  return n.matches("html,body");
}
function dl(n) {
  return n?.ownerDocument || document;
}
function R_(n) {
  return Kn(n) && n.matches(T_);
}
function A_(n) {
  if (!n || E_()) return !0;
  try {
    return n.matches(":focus-visible");
  } catch {
    return !0;
  }
}
function N_(n) {
  return n ? n.hasAttribute($y) ? n : n.querySelector("[" + $y + "]") || n : null;
}
function Dc(n, o, r) {
  return r === void 0 && (r = !0), n.filter((i) => {
    var c;
    return i.parentId === o && (!r || ((c = i.context) == null ? void 0 : c.open));
  }).flatMap((i) => [i, ...Dc(n, i.id, r)]);
}
function O_(n) {
  return "nativeEvent" in n;
}
function Bm(n, o) {
  const r = ["mouse", "pen"];
  return o || r.push("", void 0), r.includes(n);
}
var da = typeof document < "u" ? S.useLayoutEffect : function() {
}, M_ = { ...S };
function Rc(n) {
  const o = S.useRef(n);
  return da(() => {
    o.current = n;
  }), o;
}
var z_ = M_.useInsertionEffect || ((n) => n());
function ca(n) {
  const o = S.useRef(() => {
  });
  return z_(() => {
    o.current = n;
  }), S.useCallback(function() {
    for (var r = arguments.length, i = new Array(r), c = 0; c < r; c++) i[c] = arguments[c];
    return o.current == null ? void 0 : o.current(...i);
  }, []);
}
function Yy(n, o, r) {
  let { reference: i, floating: c } = n;
  const f = Xn(o), d = yh(o), m = gh(d), h = ha(o), g = f === "y", w = i.x + i.width / 2 - c.width / 2, b = i.y + i.height / 2 - c.height / 2, v = i[m] / 2 - c[m] / 2;
  let x;
  switch (h) {
    case "top":
      x = {
        x: w,
        y: i.y - c.height
      };
      break;
    case "bottom":
      x = {
        x: w,
        y: i.y + i.height
      };
      break;
    case "right":
      x = {
        x: i.x + i.width,
        y: b
      };
      break;
    case "left":
      x = {
        x: i.x - c.width,
        y: b
      };
      break;
    default:
      x = {
        x: i.x,
        y: i.y
      };
  }
  const E = Sr(o);
  return E && (x[d] += v * (E === "end" ? 1 : -1) * (r && g ? -1 : 1)), x;
}
async function j_(n, o) {
  var r;
  o === void 0 && (o = {});
  const { x: i, y: c, platform: f, rects: d, elements: m, strategy: h } = n, { boundary: g = "clippingAncestors", rootBoundary: w = "viewport", elementContext: b = "floating", altBoundary: v = !1, padding: x = 0 } = ma(o, n), E = bh(x), C = m[v ? b === "floating" ? "reference" : "floating" : b], _ = Ao(await f.getClippingRect({
    element: (r = await (f.isElement == null ? void 0 : f.isElement(C))) == null || r ? C : C.contextElement || await (f.getDocumentElement == null ? void 0 : f.getDocumentElement(m.floating)),
    boundary: g,
    rootBoundary: w,
    strategy: h
  })), R = b === "floating" ? {
    x: i,
    y: c,
    width: d.floating.width,
    height: d.floating.height
  } : d.reference, M = await (f.getOffsetParent == null ? void 0 : f.getOffsetParent(m.floating)), A = await (f.isElement == null ? void 0 : f.isElement(M)) && await (f.getScale == null ? void 0 : f.getScale(M)) || {
    x: 1,
    y: 1
  }, O = Ao(f.convertOffsetParentRelativeRectToViewportRelativeRect ? await f.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements: m,
    rect: R,
    offsetParent: M,
    strategy: h
  }) : R);
  return {
    top: (_.top - O.top + E.top) / A.y,
    bottom: (O.bottom - _.bottom + E.bottom) / A.y,
    left: (_.left - O.left + E.left) / A.x,
    right: (O.right - _.right + E.right) / A.x
  };
}
var D_ = 50, L_ = async (n, o, r) => {
  const { placement: i = "bottom", strategy: c = "absolute", middleware: f = [], platform: d } = r, m = d.detectOverflow ? d : {
    ...d,
    detectOverflow: j_
  }, h = await (d.isRTL == null ? void 0 : d.isRTL(o));
  let g = await d.getElementRects({
    reference: n,
    floating: o,
    strategy: c
  }), { x: w, y: b } = Yy(g, i, h), v = i, x = 0;
  const E = {};
  for (let C = 0; C < f.length; C++) {
    const _ = f[C];
    if (!_) continue;
    const { name: R, fn: M } = _, { x: A, y: O, data: D, reset: j } = await M({
      x: w,
      y: b,
      initialPlacement: i,
      placement: v,
      strategy: c,
      middlewareData: E,
      rects: g,
      platform: m,
      elements: {
        reference: n,
        floating: o
      }
    });
    w = A ?? w, b = O ?? b, E[R] = {
      ...E[R],
      ...D
    }, j && x < D_ && (x++, typeof j == "object" && (j.placement && (v = j.placement), j.rects && (g = j.rects === !0 ? await d.getElementRects({
      reference: n,
      floating: o,
      strategy: c
    }) : j.rects), { x: w, y: b } = Yy(g, v, h)), C = -1);
  }
  return {
    x: w,
    y: b,
    placement: v,
    strategy: c,
    middlewareData: E
  };
}, B_ = (n) => ({
  name: "arrow",
  options: n,
  async fn(o) {
    const { x: r, y: i, placement: c, rects: f, platform: d, elements: m, middlewareData: h } = o, { element: g, padding: w = 0 } = ma(n, o) || {};
    if (g == null) return {};
    const b = bh(w), v = {
      x: r,
      y: i
    }, x = yh(c), E = gh(x), C = await d.getDimensions(g), _ = x === "y", R = _ ? "top" : "left", M = _ ? "bottom" : "right", A = _ ? "clientHeight" : "clientWidth", O = f.reference[E] + f.reference[x] - v[x] - f.floating[E], D = v[x] - f.reference[x], j = await (d.getOffsetParent == null ? void 0 : d.getOffsetParent(g));
    let $ = j ? j[A] : 0;
    (!$ || !await (d.isElement == null ? void 0 : d.isElement(j))) && ($ = m.floating[A] || f.floating[E]);
    const H = O / 2 - D / 2, X = $ / 2 - C[E] / 2 - 1, J = Zn(b[R], X), W = Zn(b[M], X), ie = $ - C[E] - W, ae = $ / 2 - C[E] / 2 + H, q = s1(J, ae, ie), me = !h.arrow && Sr(c) != null && ae !== q && f.reference[E] / 2 - (ae < J ? J : W) - C[E] / 2 < 0, B = me ? ae < J ? ae - J : ae - ie : 0;
    return {
      [x]: v[x] + B,
      data: {
        [x]: q,
        centerOffset: ae - q - B,
        ...me && { alignmentOffset: B }
      },
      reset: me
    };
  }
}), H_ = function(n) {
  return n === void 0 && (n = {}), {
    name: "flip",
    options: n,
    async fn(o) {
      var r, i;
      const { placement: c, middlewareData: f, rects: d, initialPlacement: m, platform: h, elements: g } = o, { mainAxis: w = !0, crossAxis: b = !0, fallbackPlacements: v, fallbackStrategy: x = "bestFit", fallbackAxisSideDirection: E = "none", flipAlignment: C = !0, ..._ } = ma(n, o);
      if ((r = f.arrow) != null && r.alignmentOffset) return {};
      const R = ha(c), M = Xn(m), A = ha(m) === m, O = await (h.isRTL == null ? void 0 : h.isRTL(g.floating)), D = v || (A || !C ? [Gc(m)] : h_(m)), j = E !== "none";
      !v && j && D.push(...y_(m, C, E, O));
      const $ = [m, ...D], H = await h.detectOverflow(o, _), X = [];
      let J = ((i = f.flip) == null ? void 0 : i.overflows) || [];
      if (w && X.push(H[R]), b) {
        const q = m_(c, d, O);
        X.push(H[q[0]], H[q[1]]);
      }
      if (J = [...J, {
        placement: c,
        overflows: X
      }], !X.every((q) => q <= 0)) {
        var W, ie;
        const q = (((W = f.flip) == null ? void 0 : W.index) || 0) + 1, me = $[q];
        if (me && (!(b === "alignment" && M !== Xn(me)) || J.every((G) => Xn(G.placement) === M ? G.overflows[0] > 0 : !0)))
          return {
            data: {
              index: q,
              overflows: J
            },
            reset: { placement: me }
          };
        let B = (ie = J.filter((G) => G.overflows[0] <= 0).sort((G, k) => G.overflows[1] - k.overflows[1])[0]) == null ? void 0 : ie.placement;
        if (!B) switch (x) {
          case "bestFit": {
            var ae;
            const G = (ae = J.filter((k) => {
              if (j) {
                const I = Xn(k.placement);
                return I === M || I === "y";
              }
              return !0;
            }).map((k) => [k.placement, k.overflows.filter((I) => I > 0).reduce((I, ee) => I + ee, 0)]).sort((k, I) => k[1] - I[1])[0]) == null ? void 0 : ae[0];
            G && (B = G);
            break;
          }
          case "initialPlacement":
            B = m;
        }
        if (c !== B) return { reset: { placement: B } };
      }
      return {};
    }
  };
};
function qy(n, o) {
  return {
    top: n.top - o.height,
    right: n.right - o.width,
    bottom: n.bottom - o.height,
    left: n.left - o.width
  };
}
function Gy(n) {
  return f_.some((o) => n[o] >= 0);
}
var k_ = function(n) {
  return n === void 0 && (n = {}), {
    name: "hide",
    options: n,
    async fn(o) {
      const { rects: r, platform: i } = o, { strategy: c = "referenceHidden", ...f } = ma(n, o);
      switch (c) {
        case "referenceHidden": {
          const d = qy(await i.detectOverflow(o, {
            ...f,
            elementContext: "reference"
          }), r.reference);
          return { data: {
            referenceHiddenOffsets: d,
            referenceHidden: Gy(d)
          } };
        }
        case "escaped": {
          const d = qy(await i.detectOverflow(o, {
            ...f,
            altBoundary: !0
          }), r.floating);
          return { data: {
            escapedOffsets: d,
            escaped: Gy(d)
          } };
        }
        default:
          return {};
      }
    }
  };
};
function c1(n) {
  const o = Zn(...n.map((f) => f.left)), r = Zn(...n.map((f) => f.top)), i = Ln(...n.map((f) => f.right)), c = Ln(...n.map((f) => f.bottom));
  return {
    x: o,
    y: r,
    width: i - o,
    height: c - r
  };
}
function U_(n) {
  const o = n.slice().sort((c, f) => c.y - f.y), r = [];
  let i = null;
  for (let c = 0; c < o.length; c++) {
    const f = o[c];
    !i || f.y - i.y > i.height / 2 ? r.push([f]) : r[r.length - 1].push(f), i = f;
  }
  return r.map((c) => Ao(c1(c)));
}
var $_ = function(n) {
  return n === void 0 && (n = {}), {
    name: "inline",
    options: n,
    async fn(o) {
      const { placement: r, elements: i, rects: c, platform: f, strategy: d } = o, { padding: m = 2, x: h, y: g } = ma(n, o), w = Array.from(await (f.getClientRects == null ? void 0 : f.getClientRects(i.reference)) || []);
      if (!w.length) return {};
      const b = U_(w), v = Ao(c1(w)), x = bh(m);
      function E() {
        if (b.length === 2 && (b[0].left > b[1].right || b[1].left > b[0].right) && h != null && g != null) return b.find((_) => h > _.left - x.left && h < _.right + x.right && g > _.top - x.top && g < _.bottom + x.bottom) || v;
        if (b.length >= 2) {
          if (Xn(r) === "y") {
            const j = b[0], $ = b[b.length - 1], H = ha(r) === "top", X = j.top, J = $.bottom, W = H ? j.left : $.left, ie = H ? j.right : $.right;
            return Ao({
              x: W,
              y: X,
              width: ie - W,
              height: J - X
            });
          }
          const _ = ha(r) === "left", R = Ln(...b.map((j) => j.right)), M = Zn(...b.map((j) => j.left)), A = b.filter((j) => _ ? j.left === M : j.right === R), O = A[0].top, D = A[A.length - 1].bottom;
          return Ao({
            x: M,
            y: O,
            width: R - M,
            height: D - O
          });
        }
        return v;
      }
      const C = await f.getElementRects({
        reference: { getBoundingClientRect: E },
        floating: i.floating,
        strategy: d
      });
      return c.reference.x !== C.reference.x || c.reference.y !== C.reference.y || c.reference.width !== C.reference.width || c.reference.height !== C.reference.height ? { reset: { rects: C } } : {};
    }
  };
}, u1 = /* @__PURE__ */ new Set(["left", "top"]);
async function V_(n, o) {
  const { placement: r, platform: i, elements: c } = n, f = await (i.isRTL == null ? void 0 : i.isRTL(c.floating)), d = ha(r), m = Sr(r), h = Xn(r) === "y", g = u1.has(d) ? -1 : 1, w = f && h ? -1 : 1, b = ma(o, n);
  let { mainAxis: v, crossAxis: x, alignmentAxis: E } = typeof b == "number" ? {
    mainAxis: b,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: b.mainAxis || 0,
    crossAxis: b.crossAxis || 0,
    alignmentAxis: b.alignmentAxis
  };
  return m && typeof E == "number" && (x = m === "end" ? E * -1 : E), h ? {
    x: x * w,
    y: v * g
  } : {
    x: v * g,
    y: x * w
  };
}
var Y_ = function(n) {
  return n === void 0 && (n = 0), {
    name: "offset",
    options: n,
    async fn(o) {
      var r, i;
      const { x: c, y: f, placement: d, middlewareData: m } = o, h = await V_(o, n);
      return d === ((r = m.offset) == null ? void 0 : r.placement) && (i = m.arrow) != null && i.alignmentOffset ? {} : {
        x: c + h.x,
        y: f + h.y,
        data: {
          ...h,
          placement: d
        }
      };
    }
  };
}, q_ = function(n) {
  return n === void 0 && (n = {}), {
    name: "shift",
    options: n,
    async fn(o) {
      const { x: r, y: i, placement: c, platform: f } = o, { mainAxis: d = !0, crossAxis: m = !1, limiter: h = { fn: (M) => {
        let { x: A, y: O } = M;
        return {
          x: A,
          y: O
        };
      } }, ...g } = ma(n, o), w = {
        x: r,
        y: i
      }, b = await f.detectOverflow(o, g), v = Xn(c), x = ph(v);
      let E = w[x], C = w[v];
      const _ = (M, A) => s1(A + b[M === "y" ? "top" : "left"], A, A - b[M === "y" ? "bottom" : "right"]);
      d && (E = _(x, E)), m && (C = _(v, C));
      const R = h.fn({
        ...o,
        [x]: E,
        [v]: C
      });
      return {
        ...R,
        data: {
          x: R.x - r,
          y: R.y - i,
          enabled: {
            [x]: d,
            [v]: m
          }
        }
      };
    }
  };
}, G_ = function(n) {
  return n === void 0 && (n = {}), {
    options: n,
    fn(o) {
      var r, i;
      const { x: c, y: f, placement: d, rects: m, middlewareData: h } = o, { offset: g = 0, mainAxis: w = !0, crossAxis: b = !0 } = ma(n, o), v = {
        x: c,
        y: f
      }, x = Xn(d), E = ph(x);
      let C = v[E], _ = v[x];
      const R = ma(g, o), M = typeof R == "number" ? {
        mainAxis: R,
        crossAxis: 0
      } : {
        mainAxis: (r = R.mainAxis) != null ? r : 0,
        crossAxis: (i = R.crossAxis) != null ? i : 0
      };
      if (w) {
        const D = E === "y" ? "height" : "width", j = m.reference[E] - m.floating[D] + M.mainAxis, $ = m.reference[E] + m.reference[D] - M.mainAxis;
        C < j ? C = j : C > $ && (C = $);
      }
      if (b) {
        var A, O;
        const D = E === "y" ? "width" : "height", j = u1.has(ha(d)), $ = m.reference[x] - m.floating[D] + (j && ((A = h.offset) == null ? void 0 : A[x]) || 0) + (j ? 0 : M.crossAxis), H = m.reference[x] + m.reference[D] + (j ? 0 : ((O = h.offset) == null ? void 0 : O[x]) || 0) - (j ? M.crossAxis : 0);
        _ < $ ? _ = $ : _ > H && (_ = H);
      }
      return {
        [E]: C,
        [x]: _
      };
    }
  };
}, P_ = function(n) {
  return n === void 0 && (n = {}), {
    name: "size",
    options: n,
    async fn(o) {
      const { placement: r, rects: i, platform: c, elements: f } = o, { apply: d = () => {
      }, ...m } = ma(n, o), h = await c.detectOverflow(o, m), g = ha(r), w = Sr(r), b = Xn(r) === "y", { width: v, height: x } = i.floating;
      let E, C;
      g === "top" || g === "bottom" ? (E = g, C = w === (await (c.isRTL == null ? void 0 : c.isRTL(f.floating)) ? "start" : "end") ? "left" : "right") : (C = g, E = w === "end" ? "top" : "bottom");
      const _ = x - h.top - h.bottom, R = v - h.left - h.right, M = Zn(x - h[E], _), A = Zn(v - h[C], R), O = o.middlewareData.shift, D = !O;
      let j = M, $ = A;
      O != null && O.enabled.x && ($ = R), O != null && O.enabled.y && (j = _), D && !w && (b ? $ = v - 2 * Ln(h.left, h.right) : j = x - 2 * Ln(h.top, h.bottom)), await d({
        ...o,
        availableWidth: $,
        availableHeight: j
      });
      const H = await c.getDimensions(f.floating);
      return v !== H.width || x !== H.height ? { reset: { rects: !0 } } : {};
    }
  };
};
function f1(n) {
  const o = Qn(n);
  let r = parseFloat(o.width) || 0, i = parseFloat(o.height) || 0;
  const c = Kn(n), f = c ? n.offsetWidth : r, d = c ? n.offsetHeight : i, m = qc(r) !== f || qc(i) !== d;
  return m && (r = f, i = d), {
    width: r,
    height: i,
    $: m
  };
}
function Sh(n) {
  return ot(n) ? n : n.contextElement;
}
function hr(n) {
  const o = Sh(n);
  if (!Kn(o)) return Ha(1);
  const r = o.getBoundingClientRect(), { width: i, height: c, $: f } = f1(o);
  let d = (f ? qc(r.width) : r.width) / i, m = (f ? qc(r.height) : r.height) / c;
  return (!d || !Number.isFinite(d)) && (d = 1), (!m || !Number.isFinite(m)) && (m = 1), {
    x: d,
    y: m
  };
}
var X_ = /* @__PURE__ */ Ha(0);
function d1(n) {
  const o = Qt(n);
  return !nu() || !o.visualViewport ? X_ : {
    x: o.visualViewport.offsetLeft,
    y: o.visualViewport.offsetTop
  };
}
function I_(n, o, r) {
  return o === void 0 && (o = !1), !!r && o && r === Qt(n);
}
function hl(n, o, r, i) {
  o === void 0 && (o = !1), r === void 0 && (r = !1);
  const c = n.getBoundingClientRect(), f = Sh(n);
  let d = Ha(1);
  o && (i ? ot(i) && (d = hr(i)) : d = hr(n));
  const m = I_(f, r, i) ? d1(f) : Ha(0);
  let h = (c.left + m.x) / d.x, g = (c.top + m.y) / d.y, w = c.width / d.x, b = c.height / d.y;
  if (f && i) {
    const v = Qt(f), x = ot(i) ? Qt(i) : i;
    let E = v, C = Dm(E);
    for (; C && x !== E; ) {
      const _ = hr(C), R = C.getBoundingClientRect(), M = Qn(C), A = R.left + (C.clientLeft + parseFloat(M.paddingLeft)) * _.x, O = R.top + (C.clientTop + parseFloat(M.paddingTop)) * _.y;
      h *= _.x, g *= _.y, w *= _.x, b *= _.y, h += A, g += O, E = Qt(C), C = Dm(E);
    }
  }
  return Ao({
    width: w,
    height: b,
    x: h,
    y: g
  });
}
function ou(n, o) {
  const r = au(n).scrollLeft;
  return o ? o.left + r : hl(Xa(n)).left + r;
}
function m1(n, o) {
  const r = n.getBoundingClientRect();
  return {
    x: r.left + o.scrollLeft - ou(n, r),
    y: r.top + o.scrollTop
  };
}
function Q_(n) {
  let { elements: o, rect: r, offsetParent: i, strategy: c } = n;
  const f = c === "fixed", d = Xa(i), m = o ? tu(o.floating) : !1;
  if (i === d || m && f) return r;
  let h = {
    scrollLeft: 0,
    scrollTop: 0
  }, g = Ha(1);
  const w = Ha(0), b = Kn(i);
  if ((b || !f) && ((br(i) !== "body" || eu(d)) && (h = au(i)), b)) {
    const x = hl(i);
    g = hr(i), w.x = x.x + i.clientLeft, w.y = x.y + i.clientTop;
  }
  const v = d && !b && !f ? m1(d, h) : Ha(0);
  return {
    width: r.width * g.x,
    height: r.height * g.y,
    x: r.x * g.x - h.scrollLeft * g.x + w.x + v.x,
    y: r.y * g.y - h.scrollTop * g.y + w.y + v.y
  };
}
function Z_(n) {
  return n.getClientRects ? Array.from(n.getClientRects()) : [];
}
function K_(n) {
  const o = au(n), r = n.ownerDocument.body, i = Ln(n.scrollWidth, n.clientWidth, r.scrollWidth, r.clientWidth), c = Ln(n.scrollHeight, n.clientHeight, r.scrollHeight, r.clientHeight);
  let f = -o.scrollLeft + ou(n);
  const d = -o.scrollTop;
  return Qn(r).direction === "rtl" && (f += Ln(n.clientWidth, r.clientWidth) - i), {
    width: i,
    height: c,
    x: f,
    y: d
  };
}
var F_ = 25;
function J_(n, o, r) {
  r === void 0 && (r = "viewport");
  const i = r === "layoutViewport", c = Qt(n), f = Xa(n), d = c.visualViewport;
  let m = f.clientWidth, h = f.clientHeight, g = 0, w = 0;
  if (d) {
    const b = !nu() || o === "fixed";
    i ? b || (g = -d.offsetLeft, w = -d.offsetTop) : (m = d.width, h = d.height, b && (g = d.offsetLeft, w = d.offsetTop));
  }
  if (ou(f) <= 0) {
    const b = f.ownerDocument, v = b.body, x = getComputedStyle(v), E = b.compatMode === "CSS1Compat" && parseFloat(x.marginLeft) + parseFloat(x.marginRight) || 0, C = Math.abs(f.clientWidth - v.clientWidth - E), _ = getComputedStyle(f).scrollbarGutter === "stable both-edges" ? C / 2 : C;
    _ <= F_ && (m -= _);
  }
  return {
    width: m,
    height: h,
    x: g,
    y: w
  };
}
function W_(n, o) {
  const r = hl(n, !0, o === "fixed"), i = r.top + n.clientTop, c = r.left + n.clientLeft, f = hr(n);
  return {
    width: n.clientWidth * f.x,
    height: n.clientHeight * f.y,
    x: c * f.x,
    y: i * f.y
  };
}
function Py(n, o, r) {
  let i;
  if (o === "viewport" || o === "layoutViewport") i = J_(n, r, o);
  else if (o === "document") i = K_(Xa(n));
  else if (ot(o)) i = W_(o, r);
  else {
    const c = d1(n);
    i = {
      x: o.x - c.x,
      y: o.y - c.y,
      width: o.width,
      height: o.height
    };
  }
  return Ao(i);
}
function eR(n, o) {
  const r = o.get(n);
  if (r) return r;
  let i = Ba(n, [], !1).filter((m) => ot(m) && br(m) !== "body"), c = null;
  const f = Qn(n).position === "fixed";
  let d = f ? zo(n) : n;
  for (; ot(d) && !Ro(d); ) {
    const m = Qn(d), h = vh(d), g = c ? c.position : f ? "fixed" : "";
    !h && (g === "fixed" || g === "absolute" && m.position === "static") ? i = i.filter((w) => w !== d) : c = m, d = zo(d);
  }
  return o.set(n, i), i;
}
function tR(n) {
  let { element: o, boundary: r, rootBoundary: i, strategy: c } = n;
  const f = [...r === "clippingAncestors" ? tu(o) ? [] : eR(o, this._c) : [].concat(r), i], d = Py(o, f[0], c);
  let m = d.top, h = d.right, g = d.bottom, w = d.left;
  for (let b = 1; b < f.length; b++) {
    const v = Py(o, f[b], c);
    m = Ln(v.top, m), h = Zn(v.right, h), g = Zn(v.bottom, g), w = Ln(v.left, w);
  }
  return {
    width: h - w,
    height: g - m,
    x: w,
    y: m
  };
}
function nR(n) {
  const { width: o, height: r } = f1(n);
  return {
    width: o,
    height: r
  };
}
function aR(n, o, r) {
  const i = Kn(o), c = Xa(o), f = r === "fixed", d = hl(n, !0, f, o);
  let m = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const h = Ha(0);
  if ((i || !f) && ((br(o) !== "body" || eu(c)) && (m = au(o)), i)) {
    const w = hl(o, !0, f, o);
    h.x = w.x + o.clientLeft, h.y = w.y + o.clientTop;
  }
  !i && c && (h.x = ou(c));
  const g = c && !i && !f ? m1(c, m) : Ha(0);
  return {
    x: d.left + m.scrollLeft - h.x - g.x,
    y: d.top + m.scrollTop - h.y - g.y,
    width: d.width,
    height: d.height
  };
}
function fm(n) {
  return Qn(n).position === "static";
}
function Xy(n, o) {
  if (!Kn(n) || Qn(n).position === "fixed") return null;
  if (o) return o(n);
  let r = n.offsetParent;
  return Xa(n) === r && (r = r.ownerDocument.body), r;
}
function h1(n, o) {
  const r = Qt(n);
  if (tu(n)) return r;
  if (!Kn(n)) {
    let c = zo(n);
    for (; c && !Ro(c); ) {
      if (ot(c) && !fm(c)) return c;
      c = zo(c);
    }
    return r;
  }
  let i = Xy(n, o);
  for (; i && i_(i) && fm(i); ) i = Xy(i, o);
  return i && Ro(i) && fm(i) && !vh(i) ? r : i || u_(n) || r;
}
var oR = async function(n) {
  const o = this.getOffsetParent || h1, r = this.getDimensions, i = await r(n.floating);
  return {
    reference: aR(n.reference, await o(n.floating), n.strategy),
    floating: {
      x: 0,
      y: 0,
      width: i.width,
      height: i.height
    }
  };
};
function lR(n) {
  return Qn(n).direction === "rtl";
}
var rR = {
  convertOffsetParentRelativeRectToViewportRelativeRect: Q_,
  getDocumentElement: Xa,
  getClippingRect: tR,
  getOffsetParent: h1,
  getElementRects: oR,
  getClientRects: Z_,
  getDimensions: nR,
  getScale: hr,
  isElement: ot,
  isRTL: lR
};
function v1(n, o) {
  return n.x === o.x && n.y === o.y && n.width === o.width && n.height === o.height;
}
function iR(n, o, r) {
  let i = null, c;
  const f = Xa(n);
  function d() {
    var w;
    clearTimeout(c), (w = i) == null || w.disconnect(), i = null;
  }
  function m(w, b) {
    w === void 0 && (w = !1), b === void 0 && (b = 1), d();
    const v = n.getBoundingClientRect(), { left: x, top: E, width: C, height: _ } = v;
    if (w || o(), !C || !_) return;
    const R = _c(E), M = _c(f.clientWidth - (x + C)), A = _c(f.clientHeight - (E + _)), O = _c(x), D = {
      rootMargin: -R + "px " + -M + "px " + -A + "px " + -O + "px",
      threshold: Ln(0, Zn(1, b)) || 1
    };
    let j = !0;
    function $(H) {
      const X = H[0].intersectionRatio;
      if (!v1(v, n.getBoundingClientRect())) return m();
      if (X !== b) {
        if (!j) return m();
        X ? m(!1, X) : c = setTimeout(() => {
          m(!1, 1e-7);
        }, 1e3);
      }
      j = !1;
    }
    try {
      i = new IntersectionObserver($, {
        ...D,
        root: f.ownerDocument
      });
    } catch {
      i = new IntersectionObserver($, D);
    }
    i.observe(n);
  }
  const h = Qt(n), g = () => m(r);
  return h.addEventListener("resize", g), m(!0), () => {
    h.removeEventListener("resize", g), d();
  };
}
function Hm(n, o, r, i) {
  i === void 0 && (i = {});
  const { ancestorScroll: c = !0, ancestorResize: f = !0, elementResize: d = typeof ResizeObserver == "function", layoutShift: m = typeof IntersectionObserver == "function", animationFrame: h = !1 } = i, g = Sh(n), w = c || f ? [...g ? Ba(g) : [], ...o ? Ba(o) : []] : [];
  w.forEach((R) => {
    c && R.addEventListener("scroll", r), f && R.addEventListener("resize", r);
  });
  const b = g && m ? iR(g, r, f) : null;
  let v = -1, x = null;
  d && (x = new ResizeObserver((R) => {
    let [M] = R;
    M && M.target === g && x && o && (x.unobserve(o), cancelAnimationFrame(v), v = requestAnimationFrame(() => {
      var A;
      (A = x) == null || A.observe(o);
    })), r();
  }), g && !h && x.observe(g), o && x.observe(o));
  let E, C = h ? hl(n) : null;
  h && _();
  function _() {
    const R = hl(n);
    C && !v1(C, R) && r(), C = R, E = requestAnimationFrame(_);
  }
  return r(), () => {
    var R;
    w.forEach((M) => {
      c && M.removeEventListener("scroll", r), f && M.removeEventListener("resize", r);
    }), b?.(), (R = x) == null || R.disconnect(), x = null, h && cancelAnimationFrame(E);
  };
}
var sR = Y_, cR = q_, uR = H_, fR = P_, dR = k_, Iy = B_, mR = $_, hR = G_, vR = (n, o, r) => {
  const i = /* @__PURE__ */ new Map(), c = r ?? {}, f = {
    ...rR,
    ...c.platform,
    _c: i
  };
  return L_(n, o, {
    ...c,
    platform: f
  });
}, xh = /* @__PURE__ */ Ab(Nb(), 1), Lc = typeof document < "u" ? S.useLayoutEffect : function() {
};
function Pc(n, o) {
  if (n === o) return !0;
  if (typeof n != typeof o) return !1;
  if (typeof n == "function" && n.toString() === o.toString()) return !0;
  let r, i, c;
  if (n && o && typeof n == "object") {
    if (Array.isArray(n)) {
      if (r = n.length, r !== o.length) return !1;
      for (i = r; i-- !== 0; ) if (!Pc(n[i], o[i])) return !1;
      return !0;
    }
    if (c = Object.keys(n), r = c.length, r !== Object.keys(o).length) return !1;
    for (i = r; i-- !== 0; ) if (!{}.hasOwnProperty.call(o, c[i])) return !1;
    for (i = r; i-- !== 0; ) {
      const f = c[i];
      if (!(f === "_owner" && n.$$typeof) && !Pc(n[f], o[f]))
        return !1;
    }
    return !0;
  }
  return n !== n && o !== o;
}
function p1(n) {
  return typeof window > "u" ? 1 : (n.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function Qy(n, o) {
  const r = p1(n);
  return Math.round(o * r) / r;
}
function dm(n) {
  const o = S.useRef(n);
  return Lc(() => {
    o.current = n;
  }), o;
}
function pR(n) {
  n === void 0 && (n = {});
  const { placement: o = "bottom", strategy: r = "absolute", middleware: i = [], platform: c, elements: { reference: f, floating: d } = {}, transform: m = !0, whileElementsMounted: h, open: g } = n, [w, b] = S.useState({
    x: 0,
    y: 0,
    strategy: r,
    placement: o,
    middlewareData: {},
    isPositioned: !1
  }), [v, x] = S.useState(i);
  Pc(v, i) || x(i);
  const [E, C] = S.useState(null), [_, R] = S.useState(null), M = S.useCallback((k) => {
    k !== j.current && (j.current = k, C(k));
  }, []), A = S.useCallback((k) => {
    k !== $.current && ($.current = k, R(k));
  }, []), O = f || E, D = d || _, j = S.useRef(null), $ = S.useRef(null), H = S.useRef(w), X = h != null, J = dm(h), W = dm(c), ie = dm(g), ae = S.useCallback(() => {
    if (!j.current || !$.current) return;
    const k = {
      placement: o,
      strategy: r,
      middleware: v
    };
    W.current && (k.platform = W.current), vR(j.current, $.current, k).then((I) => {
      const ee = {
        ...I,
        isPositioned: ie.current !== !1
      };
      q.current && !Pc(H.current, ee) && (H.current = ee, xh.flushSync(() => {
        b(ee);
      }));
    });
  }, [
    v,
    o,
    r,
    W,
    ie
  ]);
  Lc(() => {
    g === !1 && H.current.isPositioned && (H.current.isPositioned = !1, b((k) => ({
      ...k,
      isPositioned: !1
    })));
  }, [g]);
  const q = S.useRef(!1);
  Lc(() => (q.current = !0, () => {
    q.current = !1;
  }), []), Lc(() => {
    if (O && (j.current = O), D && ($.current = D), O && D) {
      if (J.current) return J.current(O, D, ae);
      ae();
    }
  }, [
    O,
    D,
    ae,
    J,
    X
  ]);
  const me = S.useMemo(() => ({
    reference: j,
    floating: $,
    setReference: M,
    setFloating: A
  }), [M, A]), B = S.useMemo(() => ({
    reference: O,
    floating: D
  }), [O, D]), G = S.useMemo(() => {
    const k = {
      position: r,
      left: 0,
      top: 0
    };
    if (!B.floating) return k;
    const I = Qy(B.floating, w.x), ee = Qy(B.floating, w.y);
    return m ? {
      ...k,
      transform: "translate(" + I + "px, " + ee + "px)",
      ...p1(B.floating) >= 1.5 && { willChange: "transform" }
    } : {
      position: r,
      left: I,
      top: ee
    };
  }, [
    r,
    m,
    B.floating,
    w.x,
    w.y
  ]);
  return S.useMemo(() => ({
    ...w,
    update: ae,
    refs: me,
    elements: B,
    floatingStyles: G
  }), [
    w,
    ae,
    me,
    B,
    G
  ]);
}
var gR = (n) => {
  function o(r) {
    return {}.hasOwnProperty.call(r, "current");
  }
  return {
    name: "arrow",
    options: n,
    fn(r) {
      const { element: i, padding: c } = typeof n == "function" ? n(r) : n;
      return i && o(i) ? i.current != null ? Iy({
        element: i.current,
        padding: c
      }).fn(r) : {} : i ? Iy({
        element: i,
        padding: c
      }).fn(r) : {};
    }
  };
}, g1 = (n, o) => {
  const r = sR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, wh = (n, o) => {
  const r = cR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, yR = (n, o) => ({
  fn: hR(n).fn,
  options: [n, o]
}), km = (n, o) => {
  const r = uR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, bR = (n, o) => {
  const r = fR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, SR = (n, o) => {
  const r = dR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, Ti = (n, o) => {
  const r = mR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
}, y1 = (n, o) => {
  const r = gR(n);
  return {
    name: r.name,
    fn: r.fn,
    options: [n, o]
  };
};
function b1(n) {
  const o = S.useRef(void 0), r = S.useCallback((i) => {
    const c = n.map((f) => {
      if (f != null) {
        if (typeof f == "function") {
          const d = f, m = d(i);
          return typeof m == "function" ? m : () => {
            d(null);
          };
        }
        return f.current = i, () => {
          f.current = null;
        };
      }
    });
    return () => {
      c.forEach((f) => f?.());
    };
  }, n);
  return S.useMemo(() => n.every((i) => i == null) ? null : (i) => {
    o.current && (o.current(), o.current = void 0), i != null && (o.current = r(i));
  }, n);
}
var xR = "data-floating-ui-focusable", Zy = "active", Ky = "selected", wR = "ArrowLeft", CR = "ArrowRight", ER = "ArrowUp", TR = "ArrowDown", _R = [wR, CR], RR = [ER, TR], C4 = [..._R, ...RR], AR = { ...S }, Fy = !1, NR = 0, Jy = () => "floating-ui-" + Math.random().toString(36).slice(2, 6) + NR++;
function OR() {
  const [n, o] = S.useState(() => Fy ? Jy() : void 0);
  return da(() => {
    n == null && o(Jy());
  }, []), S.useEffect(() => {
    Fy = !0;
  }, []), n;
}
var S1 = AR.useId || OR;
function MR() {
  const n = /* @__PURE__ */ new Map();
  return {
    emit(o, r) {
      var i;
      (i = n.get(o)) == null || i.forEach((c) => c(r));
    },
    on(o, r) {
      n.has(o) || n.set(o, /* @__PURE__ */ new Set()), n.get(o).add(r);
    },
    off(o, r) {
      var i;
      (i = n.get(o)) == null || i.delete(r);
    }
  };
}
var zR = /* @__PURE__ */ S.createContext(null), jR = /* @__PURE__ */ S.createContext(null), Ch = () => {
  var n;
  return ((n = S.useContext(zR)) == null ? void 0 : n.id) || null;
}, Eh = () => S.useContext(jR);
function Th(n) {
  return "data-floating-ui-" + n;
}
function on(n) {
  n.current !== -1 && (clearTimeout(n.current), n.current = -1);
}
var Wy = /* @__PURE__ */ Th("safe-polygon");
function Bc(n, o, r) {
  if (r && !Bm(r)) return 0;
  if (typeof n == "number") return n;
  if (typeof n == "function") {
    const i = n();
    return typeof i == "number" ? i : i?.[o];
  }
  return n?.[o];
}
function mm(n) {
  return typeof n == "function" ? n() : n;
}
function x1(n, o) {
  o === void 0 && (o = {});
  const { open: r, onOpenChange: i, dataRef: c, events: f, elements: d } = n, { enabled: m = !0, delay: h = 0, handleClose: g = null, mouseOnly: w = !1, restMs: b = 0, move: v = !0 } = o, x = Eh(), E = Ch(), C = Rc(g), _ = Rc(h), R = Rc(r), M = Rc(b), A = S.useRef(), O = S.useRef(-1), D = S.useRef(), j = S.useRef(-1), $ = S.useRef(!0), H = S.useRef(!1), X = S.useRef(() => {
  }), J = S.useRef(!1), W = ca(() => {
    var G;
    const k = (G = c.current.openEvent) == null ? void 0 : G.type;
    return k?.includes("mouse") && k !== "mousedown";
  });
  S.useEffect(() => {
    if (!m) return;
    function G(k) {
      let { open: I } = k;
      I || (on(O), on(j), $.current = !0, J.current = !1);
    }
    return f.on("openchange", G), () => {
      f.off("openchange", G);
    };
  }, [m, f]), S.useEffect(() => {
    if (!m || !C.current || !r) return;
    function G(I) {
      W() && i(!1, I, "hover");
    }
    const k = dl(d.floating).documentElement;
    return k.addEventListener("mouseleave", G), () => {
      k.removeEventListener("mouseleave", G);
    };
  }, [
    d.floating,
    r,
    i,
    m,
    C,
    W
  ]);
  const ie = S.useCallback(function(G, k, I) {
    k === void 0 && (k = !0), I === void 0 && (I = "hover");
    const ee = Bc(_.current, "close", A.current);
    ee && !D.current ? (on(O), O.current = window.setTimeout(() => i(!1, G, I), ee)) : k && (on(O), i(!1, G, I));
  }, [_, i]), ae = ca(() => {
    X.current(), D.current = void 0;
  }), q = ca(() => {
    if (H.current) {
      const G = dl(d.floating).body;
      G.style.pointerEvents = "", G.removeAttribute(Wy), H.current = !1;
    }
  }), me = ca(() => c.current.openEvent ? ["click", "mousedown"].includes(c.current.openEvent.type) : !1);
  S.useEffect(() => {
    if (!m) return;
    function G(ne) {
      if (on(O), $.current = !1, w && !Bm(A.current) || mm(M.current) > 0 && !Bc(_.current, "open")) return;
      const ce = Bc(_.current, "open", A.current);
      ce ? O.current = window.setTimeout(() => {
        R.current || i(!0, ne, "hover");
      }, ce) : r || i(!0, ne, "hover");
    }
    function k(ne) {
      if (me()) {
        q();
        return;
      }
      X.current();
      const ce = dl(d.floating);
      if (on(j), J.current = !1, C.current && c.current.floatingContext) {
        r || on(O), D.current = C.current({
          ...c.current.floatingContext,
          tree: x,
          x: ne.clientX,
          y: ne.clientY,
          onClose() {
            q(), ae(), me() || ie(ne, !0, "safe-polygon");
          }
        });
        const fe = D.current;
        ce.addEventListener("mousemove", fe), X.current = () => {
          ce.removeEventListener("mousemove", fe);
        };
        return;
      }
      (A.current !== "touch" || !Oi(d.floating, ne.relatedTarget)) && ie(ne);
    }
    function I(ne) {
      me() || c.current.floatingContext && (C.current == null || C.current({
        ...c.current.floatingContext,
        tree: x,
        x: ne.clientX,
        y: ne.clientY,
        onClose() {
          q(), ae(), me() || ie(ne);
        }
      })(ne));
    }
    function ee() {
      on(O);
    }
    function te(ne) {
      me() || ie(ne, !1);
    }
    if (ot(d.domReference)) {
      const ne = d.domReference, ce = d.floating;
      return r && ne.addEventListener("mouseleave", I), v && ne.addEventListener("mousemove", G, { once: !0 }), ne.addEventListener("mouseenter", G), ne.addEventListener("mouseleave", k), ce && (ce.addEventListener("mouseleave", I), ce.addEventListener("mouseenter", ee), ce.addEventListener("mouseleave", te)), () => {
        r && ne.removeEventListener("mouseleave", I), v && ne.removeEventListener("mousemove", G), ne.removeEventListener("mouseenter", G), ne.removeEventListener("mouseleave", k), ce && (ce.removeEventListener("mouseleave", I), ce.removeEventListener("mouseenter", ee), ce.removeEventListener("mouseleave", te));
      };
    }
  }, [
    d,
    m,
    n,
    w,
    v,
    ie,
    ae,
    q,
    i,
    r,
    R,
    x,
    _,
    C,
    c,
    me,
    M
  ]), da(() => {
    var G;
    if (m && r && (G = C.current) != null && (G = G.__options) != null && G.blockPointerEvents && W()) {
      H.current = !0;
      const I = d.floating;
      if (ot(d.domReference) && I) {
        var k;
        const ee = dl(d.floating).body;
        ee.setAttribute(Wy, "");
        const te = d.domReference, ne = x == null || (k = x.nodesRef.current.find((ce) => ce.id === E)) == null || (k = k.context) == null ? void 0 : k.elements.floating;
        return ne && (ne.style.pointerEvents = ""), ee.style.pointerEvents = "none", te.style.pointerEvents = "auto", I.style.pointerEvents = "auto", () => {
          ee.style.pointerEvents = "", te.style.pointerEvents = "", I.style.pointerEvents = "";
        };
      }
    }
  }, [
    m,
    r,
    E,
    d,
    x,
    C,
    W
  ]), da(() => {
    r || (A.current = void 0, J.current = !1, ae(), q());
  }, [
    r,
    ae,
    q
  ]), S.useEffect(() => () => {
    ae(), on(O), on(j), q();
  }, [
    m,
    d.domReference,
    ae,
    q
  ]);
  const B = S.useMemo(() => {
    function G(k) {
      A.current = k.pointerType;
    }
    return {
      onPointerDown: G,
      onPointerEnter: G,
      onMouseMove(k) {
        const { nativeEvent: I } = k;
        function ee() {
          !$.current && !R.current && i(!0, I, "hover");
        }
        w && !Bm(A.current) || r || mm(M.current) === 0 || J.current && k.movementX ** 2 + k.movementY ** 2 < 2 || (on(j), A.current === "touch" ? ee() : (J.current = !0, j.current = window.setTimeout(ee, mm(M.current))));
      }
    };
  }, [
    w,
    i,
    r,
    R,
    M
  ]);
  return S.useMemo(() => m ? { reference: B } : {}, [m, B]);
}
var Um = () => {
}, w1 = /* @__PURE__ */ S.createContext({
  delay: 0,
  initialDelay: 0,
  timeoutMs: 0,
  currentId: null,
  setCurrentId: Um,
  setState: Um,
  isInstantPhase: !1
}), DR = () => S.useContext(w1);
function LR(n) {
  const { children: o, delay: r, timeoutMs: i = 0 } = n, [c, f] = S.useReducer((h, g) => ({
    ...h,
    ...g
  }), {
    delay: r,
    timeoutMs: i,
    initialDelay: r,
    currentId: null,
    isInstantPhase: !1
  }), d = S.useRef(null), m = S.useCallback((h) => {
    f({ currentId: h });
  }, []);
  return da(() => {
    c.currentId ? d.current === null ? d.current = c.currentId : c.isInstantPhase || f({ isInstantPhase: !0 }) : (c.isInstantPhase && f({ isInstantPhase: !1 }), d.current = null);
  }, [c.currentId, c.isInstantPhase]), /* @__PURE__ */ (0, y.jsx)(w1.Provider, {
    value: S.useMemo(() => ({
      ...c,
      setState: f,
      setCurrentId: m
    }), [c, m]),
    children: o
  });
}
function BR(n, o) {
  o === void 0 && (o = {});
  const { open: r, onOpenChange: i, floatingId: c } = n, { id: f, enabled: d = !0 } = o, m = f ?? c, h = DR(), { currentId: g, setCurrentId: w, initialDelay: b, setState: v, timeoutMs: x } = h;
  return da(() => {
    d && g && (v({ delay: {
      open: 1,
      close: Bc(b, "close")
    } }), g !== m && i(!1));
  }, [
    d,
    m,
    i,
    v,
    g,
    b
  ]), da(() => {
    function E() {
      i(!1), v({
        delay: b,
        currentId: null
      });
    }
    if (d && g && !r && g === m) {
      if (x) {
        const C = window.setTimeout(E, x);
        return () => {
          clearTimeout(C);
        };
      }
      E();
    }
  }, [
    d,
    r,
    v,
    g,
    m,
    i,
    b,
    x
  ]), da(() => {
    d && (w === Um || !r || w(m));
  }, [
    d,
    r,
    w,
    m
  ]), h;
}
function hm(n, o) {
  if (!n || !o) return !1;
  const r = o.getRootNode == null ? void 0 : o.getRootNode();
  if (n.contains(o)) return !0;
  if (r && Yc(r)) {
    let i = o;
    for (; i; ) {
      if (n === i) return !0;
      i = i.parentNode || i.host;
    }
  }
  return !1;
}
function HR(n) {
  return "composedPath" in n ? n.composedPath()[0] : n.target;
}
var kR = {
  pointerdown: "onPointerDown",
  mousedown: "onMouseDown",
  click: "onClick"
}, UR = {
  pointerdown: "onPointerDownCapture",
  mousedown: "onMouseDownCapture",
  click: "onClickCapture"
}, eb = (n) => {
  var o, r;
  return {
    escapeKey: typeof n == "boolean" ? n : (o = n?.escapeKey) != null ? o : !1,
    outsidePress: typeof n == "boolean" ? n : (r = n?.outsidePress) != null ? r : !0
  };
};
function $R(n, o) {
  o === void 0 && (o = {});
  const { open: r, onOpenChange: i, elements: c, dataRef: f } = n, { enabled: d = !0, escapeKey: m = !0, outsidePress: h = !0, outsidePressEvent: g = "pointerdown", referencePress: w = !1, referencePressEvent: b = "pointerdown", ancestorScroll: v = !1, bubbles: x, capture: E } = o, C = Eh(), _ = ca(typeof h == "function" ? h : () => !1), R = typeof h == "function" ? _ : h, M = S.useRef(!1), { escapeKey: A, outsidePress: O } = eb(x), { escapeKey: D, outsidePress: j } = eb(E), $ = S.useRef(!1), H = ca((q) => {
    var me;
    if (!r || !d || !m || q.key !== "Escape" || $.current) return;
    const B = (me = f.current.floatingContext) == null ? void 0 : me.nodeId, G = C ? Dc(C.nodesRef.current, B) : [];
    if (!A && (q.stopPropagation(), G.length > 0)) {
      let k = !0;
      if (G.forEach((I) => {
        var ee;
        if ((ee = I.context) != null && ee.open && !I.context.dataRef.current.__escapeKeyBubbles) {
          k = !1;
          return;
        }
      }), !k) return;
    }
    i(!1, O_(q) ? q.nativeEvent : q, "escape-key");
  }), X = ca((q) => {
    var me;
    const B = () => {
      var G;
      H(q), (G = dr(q)) == null || G.removeEventListener("keydown", B);
    };
    (me = dr(q)) == null || me.addEventListener("keydown", B);
  }), J = ca((q) => {
    var me;
    const B = f.current.insideReactTree;
    f.current.insideReactTree = !1;
    const G = M.current;
    if (M.current = !1, g === "click" && G || B || typeof R == "function" && !R(q)) return;
    const k = dr(q), I = "[" + Th("inert") + "]", ee = dl(c.floating).querySelectorAll(I);
    let te = ot(k) ? k : null;
    for (; te && !Ro(te); ) {
      const N = zo(te);
      if (Ro(N) || !ot(N)) break;
      te = N;
    }
    if (ee.length && ot(k) && !__(k) && !Oi(k, c.floating) && Array.from(ee).every((N) => !Oi(te, N))) return;
    if (Kn(k) && ae) {
      const N = Ro(k), Z = Qn(k), ue = /auto|scroll/, re = N || ue.test(Z.overflowX), ge = N || ue.test(Z.overflowY), he = re && k.clientWidth > 0 && k.scrollWidth > k.clientWidth, ye = ge && k.clientHeight > 0 && k.scrollHeight > k.clientHeight, ve = Z.direction === "rtl", de = ye && (ve ? q.offsetX <= k.offsetWidth - k.clientWidth : q.offsetX > k.clientWidth), Ne = he && q.offsetY > k.clientHeight;
      if (de || Ne) return;
    }
    const ne = (me = f.current.floatingContext) == null ? void 0 : me.nodeId, ce = C && Dc(C.nodesRef.current, ne).some((N) => {
      var Z;
      return um(q, (Z = N.context) == null ? void 0 : Z.elements.floating);
    });
    if (um(q, c.floating) || um(q, c.domReference) || ce) return;
    const fe = C ? Dc(C.nodesRef.current, ne) : [];
    if (fe.length > 0) {
      let N = !0;
      if (fe.forEach((Z) => {
        var ue;
        if ((ue = Z.context) != null && ue.open && !Z.context.dataRef.current.__outsidePressBubbles) {
          N = !1;
          return;
        }
      }), !N) return;
    }
    i(!1, q, "outside-press");
  }), W = ca((q) => {
    var me;
    const B = () => {
      var G;
      J(q), (G = dr(q)) == null || G.removeEventListener(g, B);
    };
    (me = dr(q)) == null || me.addEventListener(g, B);
  });
  S.useEffect(() => {
    if (!r || !d) return;
    f.current.__escapeKeyBubbles = A, f.current.__outsidePressBubbles = O;
    let q = -1;
    function me(ee) {
      i(!1, ee, "ancestor-scroll");
    }
    function B() {
      window.clearTimeout(q), $.current = !0;
    }
    function G() {
      q = window.setTimeout(() => {
        $.current = !1;
      }, nu() ? 5 : 0);
    }
    const k = dl(c.floating);
    m && (k.addEventListener("keydown", D ? X : H, D), k.addEventListener("compositionstart", B), k.addEventListener("compositionend", G)), R && k.addEventListener(g, j ? W : J, j);
    let I = [];
    return v && (ot(c.domReference) && (I = Ba(c.domReference)), ot(c.floating) && (I = I.concat(Ba(c.floating))), !ot(c.reference) && c.reference && c.reference.contextElement && (I = I.concat(Ba(c.reference.contextElement)))), I = I.filter((ee) => {
      var te;
      return ee !== ((te = k.defaultView) == null ? void 0 : te.visualViewport);
    }), I.forEach((ee) => {
      ee.addEventListener("scroll", me);
    }), () => {
      m && (k.removeEventListener("keydown", D ? X : H, D), k.removeEventListener("compositionstart", B), k.removeEventListener("compositionend", G)), R && k.removeEventListener(g, j ? W : J, j), I.forEach((ee) => {
        ee.removeEventListener("scroll", me);
      }), window.clearTimeout(q);
    };
  }, [
    f,
    c,
    m,
    R,
    g,
    r,
    i,
    v,
    d,
    A,
    O,
    H,
    D,
    X,
    J,
    j,
    W
  ]), S.useEffect(() => {
    f.current.insideReactTree = !1;
  }, [
    f,
    R,
    g
  ]);
  const ie = S.useMemo(() => ({
    onKeyDown: H,
    ...w && {
      [kR[b]]: (q) => {
        i(!1, q.nativeEvent, "reference-press");
      },
      ...b !== "click" && { onClick(q) {
        i(!1, q.nativeEvent, "reference-press");
      } }
    }
  }), [
    H,
    i,
    w,
    b
  ]), ae = S.useMemo(() => {
    function q(me) {
      me.button === 0 && (M.current = !0);
    }
    return {
      onKeyDown: H,
      onMouseDown: q,
      onMouseUp: q,
      [UR[g]]: () => {
        f.current.insideReactTree = !0;
      }
    };
  }, [
    H,
    g,
    f
  ]);
  return S.useMemo(() => d ? {
    reference: ie,
    floating: ae
  } : {}, [
    d,
    ie,
    ae
  ]);
}
function VR(n) {
  const { open: o = !1, onOpenChange: r, elements: i } = n, c = S1(), f = S.useRef({}), [d] = S.useState(() => MR()), m = Ch() != null, [h, g] = S.useState(i.reference), w = ca((x, E, C) => {
    f.current.openEvent = x ? E : void 0, d.emit("openchange", {
      open: x,
      event: E,
      reason: C,
      nested: m
    }), r?.(x, E, C);
  }), b = S.useMemo(() => ({ setPositionReference: g }), []), v = S.useMemo(() => ({
    reference: h || i.reference || null,
    floating: i.floating || null,
    domReference: i.reference
  }), [
    h,
    i.reference,
    i.floating
  ]);
  return S.useMemo(() => ({
    dataRef: f,
    open: o,
    onOpenChange: w,
    elements: v,
    events: d,
    floatingId: c,
    refs: b
  }), [
    o,
    w,
    v,
    d,
    c,
    b
  ]);
}
function lu(n) {
  var o, r;
  let { elements: i, ...c } = n === void 0 ? {} : n;
  const { nodeId: f } = c, d = VR({
    ...c,
    elements: {
      reference: (o = i?.reference) != null ? o : null,
      floating: (r = i?.floating) != null ? r : null
    }
  }), m = c.rootContext || d, h = m.elements, [g, w] = S.useState(null), [b, v] = S.useState(null), x = h?.domReference || g, E = S.useRef(null), C = Eh();
  da(() => {
    x && (E.current = x);
  }, [x]);
  const _ = pR({
    ...c,
    elements: {
      ...h,
      ...b && { reference: b }
    }
  }), R = S.useCallback((j) => {
    const $ = ot(j) ? {
      getBoundingClientRect: () => j.getBoundingClientRect(),
      getClientRects: () => j.getClientRects(),
      contextElement: j
    } : j;
    v($), _.refs.setReference($);
  }, [_.refs]), M = S.useCallback((j) => {
    (ot(j) || j === null) && (E.current = j, w(j)), (ot(_.refs.reference.current) || _.refs.reference.current === null || j !== null && !ot(j)) && _.refs.setReference(j);
  }, [_.refs]), A = S.useMemo(() => ({
    ..._.refs,
    setReference: M,
    setPositionReference: R,
    domReference: E
  }), [
    _.refs,
    M,
    R
  ]), O = S.useMemo(() => ({
    ..._.elements,
    domReference: x
  }), [_.elements, x]), D = S.useMemo(() => ({
    ..._,
    ...m,
    refs: A,
    elements: O,
    nodeId: f
  }), [
    _,
    A,
    O,
    f,
    m
  ]);
  return da(() => {
    m.dataRef.current.floatingContext = D;
    const j = C?.nodesRef.current.find(($) => $.id === f);
    j && (j.context = D);
  }), S.useMemo(() => ({
    ..._,
    context: D,
    refs: A,
    elements: O
  }), [
    _,
    A,
    O,
    D
  ]);
}
function vm() {
  return C_() && w_();
}
function YR(n, o) {
  o === void 0 && (o = {});
  const { open: r, onOpenChange: i, events: c, dataRef: f, elements: d } = n, { enabled: m = !0, visibleOnly: h = !0 } = o, g = S.useRef(!1), w = S.useRef(-1), b = S.useRef(!0);
  S.useEffect(() => {
    if (!m) return;
    const x = Qt(d.domReference);
    function E() {
      !r && Kn(d.domReference) && d.domReference === Vy(dl(d.domReference)) && (g.current = !0);
    }
    function C() {
      b.current = !0;
    }
    function _() {
      b.current = !1;
    }
    return x.addEventListener("blur", E), vm() && (x.addEventListener("keydown", C, !0), x.addEventListener("pointerdown", _, !0)), () => {
      x.removeEventListener("blur", E), vm() && (x.removeEventListener("keydown", C, !0), x.removeEventListener("pointerdown", _, !0));
    };
  }, [
    d.domReference,
    r,
    m
  ]), S.useEffect(() => {
    if (!m) return;
    function x(E) {
      let { reason: C } = E;
      (C === "reference-press" || C === "escape-key") && (g.current = !0);
    }
    return c.on("openchange", x), () => {
      c.off("openchange", x);
    };
  }, [c, m]), S.useEffect(() => () => {
    on(w);
  }, []);
  const v = S.useMemo(() => ({
    onMouseLeave() {
      g.current = !1;
    },
    onFocus(x) {
      if (g.current) return;
      const E = dr(x.nativeEvent);
      if (h && ot(E)) {
        if (vm() && !x.relatedTarget) {
          if (!b.current && !R_(E)) return;
        } else if (!A_(E)) return;
      }
      i(!0, x.nativeEvent, "focus");
    },
    onBlur(x) {
      g.current = !1;
      const E = x.relatedTarget, C = x.nativeEvent, _ = ot(E) && E.hasAttribute(Th("focus-guard")) && E.getAttribute("data-type") === "outside";
      w.current = window.setTimeout(() => {
        var R;
        const M = Vy(d.domReference ? d.domReference.ownerDocument : document);
        !E && M === d.domReference || Oi((R = f.current.floatingContext) == null ? void 0 : R.refs.floating.current, M) || Oi(d.domReference, M) || _ || i(!1, C, "focus");
      });
    }
  }), [
    f,
    d.domReference,
    i,
    h
  ]);
  return S.useMemo(() => m ? { reference: v } : {}, [m, v]);
}
function pm(n, o, r) {
  const i = /* @__PURE__ */ new Map(), c = r === "item";
  let f = n;
  if (c && n) {
    const { [Zy]: d, [Ky]: m, ...h } = n;
    f = h;
  }
  return {
    ...r === "floating" && {
      tabIndex: -1,
      [xR]: ""
    },
    ...f,
    ...o.map((d) => {
      const m = d ? d[r] : null;
      return typeof m == "function" ? n ? m(n) : null : m;
    }).concat(n).reduce((d, m) => (m && Object.entries(m).forEach((h) => {
      let [g, w] = h;
      if (!(c && [Zy, Ky].includes(g)))
        if (g.indexOf("on") === 0) {
          if (i.has(g) || i.set(g, []), typeof w == "function") {
            var b;
            (b = i.get(g)) == null || b.push(w), d[g] = function() {
              for (var v, x = arguments.length, E = new Array(x), C = 0; C < x; C++) E[C] = arguments[C];
              return (v = i.get(g)) == null ? void 0 : v.map((_) => _(...E)).find((_) => _ !== void 0);
            };
          }
        } else d[g] = w;
    }), d), {})
  };
}
function C1(n) {
  n === void 0 && (n = []);
  const o = n.map((m) => m?.reference), r = n.map((m) => m?.floating), i = n.map((m) => m?.item), c = S.useCallback((m) => pm(m, n, "reference"), o), f = S.useCallback((m) => pm(m, n, "floating"), r), d = S.useCallback((m) => pm(m, n, "item"), i);
  return S.useMemo(() => ({
    getReferenceProps: c,
    getFloatingProps: f,
    getItemProps: d
  }), [
    c,
    f,
    d
  ]);
}
var qR = /* @__PURE__ */ new Map([
  ["select", "listbox"],
  ["combobox", "listbox"],
  ["label", !1]
]);
function GR(n, o) {
  var r, i;
  o === void 0 && (o = {});
  const { open: c, elements: f, floatingId: d } = n, { enabled: m = !0, role: h = "dialog" } = o, g = S1(), w = ((r = f.domReference) == null ? void 0 : r.id) || g, b = S.useMemo(() => {
    var R;
    return ((R = N_(f.floating)) == null ? void 0 : R.id) || d;
  }, [f.floating, d]), v = (i = qR.get(h)) != null ? i : h, x = Ch() != null, E = S.useMemo(() => v === "tooltip" || h === "label" ? { ["aria-" + (h === "label" ? "labelledby" : "describedby")]: c ? b : void 0 } : {
    "aria-expanded": c ? "true" : "false",
    "aria-haspopup": v === "alertdialog" ? "dialog" : v,
    "aria-controls": c ? b : void 0,
    ...v === "listbox" && { role: "combobox" },
    ...v === "menu" && { id: w },
    ...v === "menu" && x && { role: "menuitem" },
    ...h === "select" && { "aria-autocomplete": "none" },
    ...h === "combobox" && { "aria-autocomplete": "list" }
  }, [
    v,
    b,
    x,
    c,
    w,
    h
  ]), C = S.useMemo(() => {
    const R = {
      id: b,
      ...v && { role: v }
    };
    return v === "tooltip" || h === "label" ? R : {
      ...R,
      ...v === "menu" && { "aria-labelledby": w }
    };
  }, [
    v,
    b,
    w,
    h
  ]), _ = S.useCallback((R) => {
    let { active: M, selected: A } = R;
    const O = {
      role: "option",
      ...M && { id: b + "-fui-option" }
    };
    switch (h) {
      case "select":
      case "combobox":
        return {
          ...O,
          "aria-selected": A
        };
    }
    return {};
  }, [b, h]);
  return S.useMemo(() => m ? {
    reference: E,
    floating: C,
    item: _
  } : {}, [
    m,
    E,
    C,
    _
  ]);
}
function E1(n, o, r) {
  return r === void 0 && (r = !0), n.filter((i) => {
    var c;
    return i.parentId === o && (!r || ((c = i.context) == null ? void 0 : c.open));
  }).flatMap((i) => [i, ...E1(n, i.id, r)]);
}
function tb(n, o) {
  const [r, i] = n;
  let c = !1;
  const f = o.length;
  for (let d = 0, m = f - 1; d < f; m = d++) {
    const [h, g] = o[d] || [0, 0], [w, b] = o[m] || [0, 0];
    g >= i != b >= i && r <= (w - h) * (i - g) / (b - g) + h && (c = !c);
  }
  return c;
}
function PR(n, o) {
  return n[0] >= o.x && n[0] <= o.x + o.width && n[1] >= o.y && n[1] <= o.y + o.height;
}
function T1(n) {
  n === void 0 && (n = {});
  const { buffer: o = 0.5, blockPointerEvents: r = !1, requireIntent: i = !0 } = n, c = { current: -1 };
  let f = !1, d = null, m = null, h = typeof performance < "u" ? performance.now() : 0;
  function g(b, v) {
    const x = performance.now(), E = x - h;
    if (d === null || m === null || E === 0)
      return d = b, m = v, h = x, null;
    const C = b - d, _ = v - m, R = Math.sqrt(C * C + _ * _) / E;
    return d = b, m = v, h = x, R;
  }
  const w = (b) => {
    let { x: v, y: x, placement: E, elements: C, onClose: _, nodeId: R, tree: M } = b;
    return function(O) {
      function D() {
        on(c), _();
      }
      if (on(c), !C.domReference || !C.floating || E == null || v == null || x == null) return;
      const { clientX: j, clientY: $ } = O, H = [j, $], X = HR(O), J = O.type === "mouseleave", W = hm(C.floating, X), ie = hm(C.domReference, X), ae = C.domReference.getBoundingClientRect(), q = C.floating.getBoundingClientRect(), me = E.split("-")[0], B = v > q.right - q.width / 2, G = x > q.bottom - q.height / 2, k = PR(H, ae), I = q.width > ae.width, ee = q.height > ae.height, te = (I ? ae : q).left, ne = (I ? ae : q).right, ce = (ee ? ae : q).top, fe = (ee ? ae : q).bottom;
      if (W && (f = !0, !J))
        return;
      if (ie && (f = !1), ie && !J) {
        f = !0;
        return;
      }
      if (J && ot(O.relatedTarget) && hm(C.floating, O.relatedTarget) || M && E1(M.nodesRef.current, R).length) return;
      if (me === "top" && x >= ae.bottom - 1 || me === "bottom" && x <= ae.top + 1 || me === "left" && v >= ae.right - 1 || me === "right" && v <= ae.left + 1) return D();
      let N = [];
      switch (me) {
        case "top":
          N = [
            [te, ae.top + 1],
            [te, q.bottom - 1],
            [ne, q.bottom - 1],
            [ne, ae.top + 1]
          ];
          break;
        case "bottom":
          N = [
            [te, q.top + 1],
            [te, ae.bottom - 1],
            [ne, ae.bottom - 1],
            [ne, q.top + 1]
          ];
          break;
        case "left":
          N = [
            [q.right - 1, fe],
            [q.right - 1, ce],
            [ae.left + 1, ce],
            [ae.left + 1, fe]
          ];
          break;
        case "right":
          N = [
            [ae.right - 1, fe],
            [ae.right - 1, ce],
            [q.left + 1, ce],
            [q.left + 1, fe]
          ];
      }
      function Z(ue) {
        let [re, ge] = ue;
        switch (me) {
          case "top":
            return [
              [I ? re + o / 2 : B ? re + o * 4 : re - o * 4, ge + o + 1],
              [I ? re - o / 2 : B ? re + o * 4 : re - o * 4, ge + o + 1],
              [q.left, B || I ? q.bottom - o : q.top],
              [q.right, B ? I ? q.bottom - o : q.top : q.bottom - o]
            ];
          case "bottom":
            return [
              [I ? re + o / 2 : B ? re + o * 4 : re - o * 4, ge - o],
              [I ? re - o / 2 : B ? re + o * 4 : re - o * 4, ge - o],
              [q.left, B || I ? q.top + o : q.bottom],
              [q.right, B ? I ? q.top + o : q.bottom : q.top + o]
            ];
          case "left": {
            const he = [re + o + 1, ee ? ge + o / 2 : G ? ge + o * 4 : ge - o * 4], ye = [re + o + 1, ee ? ge - o / 2 : G ? ge + o * 4 : ge - o * 4];
            return [
              [G || ee ? q.right - o : q.left, q.top],
              [G ? ee ? q.right - o : q.left : q.right - o, q.bottom],
              he,
              ye
            ];
          }
          case "right":
            return [
              [re - o, ee ? ge + o / 2 : G ? ge + o * 4 : ge - o * 4],
              [re - o, ee ? ge - o / 2 : G ? ge + o * 4 : ge - o * 4],
              [G || ee ? q.left + o : q.right, q.top],
              [G ? ee ? q.left + o : q.right : q.left + o, q.bottom]
            ];
        }
      }
      if (!tb([j, $], N)) {
        if (f && !k) return D();
        if (!J && i) {
          const ue = g(O.clientX, O.clientY);
          if (ue !== null && ue < 0.1) return D();
        }
        tb([j, $], Z([v, x])) ? !f && i && (c.current = window.setTimeout(D, 40)) : D();
      }
    };
  };
  return w.__options = { blockPointerEvents: r }, w;
}
var _1 = {
  scrollHideDelay: 1e3,
  type: "hover",
  scrollbars: "xy"
}, R1 = (n, { scrollbarSize: o, overscrollBehavior: r, scrollbars: i }) => {
  let c = r;
  return r && i && (i === "x" ? c = `${r} auto` : i === "y" && (c = `auto ${r}`)), { root: {
    "--scrollarea-scrollbar-size": se(o),
    "--scrollarea-over-scroll-behavior": c
  } };
}, Lo = Ee((n) => {
  const o = pe("ScrollArea", _1, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, scrollbarSize: m, vars: h, type: g, scrollHideDelay: w, viewportProps: b, viewportRef: v, onScrollPositionChange: x, children: E, offsetScrollbars: C, scrollbars: _, onBottomReached: R, onTopReached: M, onLeftReached: A, onRightReached: O, overscrollBehavior: D, startScrollPosition: j, verticalScrollbarPosition: $, attributes: H, ...X } = o, [J, W] = (0, S.useState)(!1), [ie, ae] = (0, S.useState)(!1), [q, me] = (0, S.useState)(!1), B = (0, S.useRef)(!0), G = (0, S.useRef)(!1), k = (0, S.useRef)(!0), I = (0, S.useRef)(!1), ee = Me({
    name: "ScrollArea",
    props: o,
    classes: hh,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: H,
    vars: h,
    varsResolver: R1
  }), te = (0, S.useRef)(null), [ne, ce] = (0, S.useState)(null), fe = (0, S.useCallback)((Z) => {
    ce((ue) => ue === Z ? ue : Z);
  }, []), N = b1([
    v,
    te,
    fe
  ]);
  return Mo(C === "present" ? ne : null, () => {
    const Z = te.current;
    Z && (ae(Z.scrollHeight > Z.clientHeight), me(Z.scrollWidth > Z.clientWidth));
  }), Ua(() => {
    j && te.current && te.current.scrollTo({
      left: j.x ?? 0,
      top: j.y ?? 0
    });
  }, []), /* @__PURE__ */ (0, y.jsxs)(Zb, {
    getStyles: ee,
    type: g === "never" ? "always" : g,
    scrollHideDelay: w,
    scrollbars: _,
    ...ee("root"),
    ...X,
    children: [
      /* @__PURE__ */ (0, y.jsx)(l1, {
        ...b,
        ...ee("viewport", { style: b?.style }),
        ref: N,
        "data-offset-scrollbars": C === !0 ? "xy" : C || void 0,
        "data-scrollbars": _ || void 0,
        "data-vertical-scrollbar-position": $ || void 0,
        "data-horizontal-hidden": C === "present" && !q ? "true" : void 0,
        "data-vertical-hidden": C === "present" && !ie ? "true" : void 0,
        onScroll: (Z) => {
          b?.onScroll?.(Z), x?.({
            x: Z.currentTarget.scrollLeft,
            y: Z.currentTarget.scrollTop
          });
          const { scrollTop: ue, scrollHeight: re, clientHeight: ge, scrollLeft: he, scrollWidth: ye, clientWidth: ve } = Z.currentTarget, de = ue - (re - ge) >= -0.8, Ne = ue === 0;
          de && !G.current && R?.(), Ne && !B.current && M?.(), G.current = de, B.current = Ne;
          const Q = he - (ye - ve) >= -0.8, Se = he === 0;
          Q && !I.current && O?.(), Se && !k.current && A?.(), I.current = Q, k.current = Se;
        },
        children: E
      }),
      (_ === "xy" || _ === "x") && /* @__PURE__ */ (0, y.jsx)(zm, {
        ...ee("scrollbar"),
        orientation: "horizontal",
        "data-vertical-scrollbar-position": $ || void 0,
        "data-hidden": g === "never" || C === "present" && !q ? !0 : void 0,
        forceMount: !0,
        onMouseEnter: () => W(!0),
        onMouseLeave: () => W(!1),
        children: /* @__PURE__ */ (0, y.jsx)(jm, { ...ee("thumb") })
      }),
      (_ === "xy" || _ === "y") && /* @__PURE__ */ (0, y.jsx)(zm, {
        ...ee("scrollbar"),
        orientation: "vertical",
        "data-vertical-scrollbar-position": $ || void 0,
        "data-hidden": g === "never" || C === "present" && !ie ? !0 : void 0,
        forceMount: !0,
        onMouseEnter: () => W(!0),
        onMouseLeave: () => W(!1),
        children: /* @__PURE__ */ (0, y.jsx)(jm, { ...ee("thumb") })
      }),
      /* @__PURE__ */ (0, y.jsx)(e_, {
        ...ee("corner"),
        "data-vertical-scrollbar-position": $ || void 0,
        "data-hovered": J || void 0,
        "data-hidden": g === "never" || void 0
      })
    ]
  });
});
Lo.displayName = "@mantine/core/ScrollArea";
var _h = Ee((n) => {
  const { children: o, classNames: r, styles: i, scrollbarSize: c, scrollHideDelay: f, type: d, dir: m, offsetScrollbars: h, overscrollBehavior: g, viewportRef: w, onScrollPositionChange: b, unstyled: v, variant: x, viewportProps: E, scrollbars: C, style: _, vars: R, onBottomReached: M, onTopReached: A, startScrollPosition: O, verticalScrollbarPosition: D, onOverflowChange: j, ...$ } = pe("ScrollAreaAutosize", _1, n), H = (0, S.useRef)(null), [X, J] = (0, S.useState)(null), W = (0, S.useCallback)((B) => {
    J((G) => G === B ? G : B);
  }, []), ie = b1([
    w,
    H,
    W
  ]), ae = (0, S.useRef)(!1), q = (0, S.useRef)(!1), me = (0, S.useEffectEvent)(() => {
    const B = H.current;
    if (!B || !j) return;
    const G = B.scrollHeight > B.clientHeight;
    G !== ae.current && (q.current ? j(G) : (q.current = !0, G && j(!0)), ae.current = G);
  });
  return Mo(j ? X : null, me), /* @__PURE__ */ (0, y.jsx)(xe, {
    ...$,
    variant: x,
    style: [{
      display: "flex",
      overflow: "hidden"
    }, _],
    children: /* @__PURE__ */ (0, y.jsx)(xe, {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        ...C === "y" && { minWidth: 0 },
        ...C === "x" && { minHeight: 0 },
        ...C === "xy" && {
          minWidth: 0,
          minHeight: 0
        },
        ...C === !1 && {
          minWidth: 0,
          minHeight: 0
        }
      },
      children: /* @__PURE__ */ (0, y.jsx)(Lo, {
        classNames: r,
        styles: i,
        scrollHideDelay: f,
        scrollbarSize: c,
        type: d,
        dir: m,
        offsetScrollbars: h,
        overscrollBehavior: g,
        viewportRef: ie,
        onScrollPositionChange: b,
        unstyled: v,
        variant: x,
        viewportProps: E,
        vars: R,
        scrollbars: C,
        onBottomReached: M,
        onTopReached: A,
        startScrollPosition: O,
        verticalScrollbarPosition: D,
        "data-autosize": "true",
        children: o
      })
    })
  });
});
Lo.classes = hh;
Lo.varsResolver = R1;
_h.displayName = "@mantine/core/ScrollAreaAutosize";
_h.classes = hh;
Lo.Autosize = _h;
var A1 = { root: "m_87cf2631" }, XR = { __staticSelector: "UnstyledButton" }, Ia = Sn((n) => {
  const o = pe("UnstyledButton", XR, n), { className: r, component: i = "button", __staticSelector: c, unstyled: f, classNames: d, styles: m, style: h, attributes: g, ...w } = o, b = Me({
    name: c,
    props: o,
    classes: A1,
    className: r,
    style: h,
    classNames: d,
    styles: m,
    unstyled: f,
    attributes: g
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...b("root", { focusable: !0 }),
    component: i,
    type: i === "button" ? "button" : void 0,
    ...w
  });
});
Ia.classes = A1;
Ia.displayName = "@mantine/core/UnstyledButton";
var N1 = { root: "m_515a97f8" }, Rh = Ee((n) => {
  const o = pe("VisuallyHidden", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, attributes: h, ...g } = o, w = Me({
    name: "VisuallyHidden",
    classes: N1,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: h
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "span",
    ...w("root"),
    ...g
  });
});
Rh.classes = N1;
Rh.displayName = "@mantine/core/VisuallyHidden";
var O1 = { root: "m_1b7284a3" }, M1 = (n, { radius: o, shadow: r }) => ({ root: {
  "--paper-radius": o === void 0 ? void 0 : St(o),
  "--paper-shadow": eh(r)
} }), ru = Sn((n) => {
  const o = pe("Paper", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, withBorder: m, vars: h, radius: g, shadow: w, variant: b, mod: v, attributes: x, ...E } = o, C = Me({
    name: "Paper",
    props: o,
    classes: O1,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: x,
    vars: h,
    varsResolver: M1
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    mod: [{ withBorder: m }, v],
    ...C("root"),
    variant: b,
    ...E
  });
});
ru.classes = O1;
ru.varsResolver = M1;
ru.displayName = "@mantine/core/Paper";
function nb(n, o, r, i) {
  return n === "center" || i === "center" ? { top: o } : n === "end" ? { bottom: r } : n === "start" ? { top: r } : {};
}
function ab(n, o, r, i, c) {
  return n === "center" || i === "center" ? { left: o } : n === "end" ? { [c === "ltr" ? "right" : "left"]: r } : n === "start" ? { [c === "ltr" ? "left" : "right"]: r } : {};
}
var IR = {
  bottom: "borderTopLeftRadius",
  left: "borderTopRightRadius",
  right: "borderBottomLeftRadius",
  top: "borderBottomRightRadius"
};
function QR({ position: n, arrowSize: o, dir: r }) {
  const [i, c] = n.split("-");
  if (!c) return;
  const f = {
    width: o,
    height: o,
    position: "absolute"
  };
  if (i === "bottom") {
    const d = c === "start", m = d ? r === "ltr" ? "left" : "right" : r === "ltr" ? "right" : "left";
    return {
      ...f,
      top: -o,
      [m]: 0,
      clipPath: d !== (r === "rtl") ? "polygon(0% 0%, 0% 100%, 100% 100%)" : "polygon(100% 0%, 0% 100%, 100% 100%)"
    };
  }
  if (i === "top") {
    const d = c === "start", m = d ? r === "ltr" ? "left" : "right" : r === "ltr" ? "right" : "left";
    return {
      ...f,
      bottom: -o,
      [m]: 0,
      clipPath: d !== (r === "rtl") ? "polygon(0% 0%, 100% 0%, 0% 100%)" : "polygon(0% 0%, 100% 0%, 100% 100%)"
    };
  }
  if (i === "left") return {
    ...f,
    right: -o,
    [c === "start" ? "top" : "bottom"]: 0,
    clipPath: c === "start" ? "polygon(0% 0%, 100% 0%, 0% 100%)" : "polygon(0% 0%, 0% 100%, 100% 100%)"
  };
  if (i === "right") return {
    ...f,
    left: -o,
    [c === "start" ? "top" : "bottom"]: 0,
    clipPath: c === "start" ? "polygon(0% 0%, 100% 0%, 100% 100%)" : "polygon(100% 0%, 0% 100%, 100% 100%)"
  };
}
function ZR({ position: n, arrowSize: o, arrowOffset: r, arrowRadius: i, arrowPosition: c, arrowX: f, arrowY: d, dir: m }) {
  if (c === "merge") {
    const v = QR({
      position: n,
      arrowSize: o,
      dir: m
    });
    if (v) return v;
  }
  const [h, g = "center"] = n.split("-"), w = {
    width: o,
    height: o,
    transform: "rotate(45deg)",
    position: "absolute",
    [IR[h]]: i
  }, b = -o / 2;
  return h === "left" ? {
    ...w,
    ...nb(g, d, r, c),
    right: b,
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    clipPath: "polygon(100% 0, 0 0, 100% 100%)"
  } : h === "right" ? {
    ...w,
    ...nb(g, d, r, c),
    left: b,
    borderRightColor: "transparent",
    borderTopColor: "transparent",
    clipPath: "polygon(0 100%, 0 0, 100% 100%)"
  } : h === "top" ? {
    ...w,
    ...ab(g, f, r, c, m),
    bottom: b,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
    clipPath: "polygon(0 100%, 100% 100%, 100% 0)"
  } : h === "bottom" ? {
    ...w,
    ...ab(g, f, r, c, m),
    top: b,
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
    clipPath: "polygon(0 100%, 0 0, 100% 0)"
  } : {};
}
function z1({ position: n, dir: o }) {
  const [r, i] = n.split("-");
  if (!i) return;
  const c = i === "start" && o === "ltr" || i === "end" && o === "rtl";
  if (r === "bottom") return c ? { borderTopLeftRadius: 0 } : { borderTopRightRadius: 0 };
  if (r === "top") return c ? { borderBottomLeftRadius: 0 } : { borderBottomRightRadius: 0 };
  if (r === "left") return i === "start" ? { borderTopRightRadius: 0 } : { borderBottomRightRadius: 0 };
  if (r === "right") return i === "start" ? { borderTopLeftRadius: 0 } : { borderBottomLeftRadius: 0 };
}
function Xc({ position: n, arrowSize: o, arrowOffset: r, arrowRadius: i, arrowPosition: c, visible: f, arrowX: d, arrowY: m, style: h, ...g }) {
  const { dir: w } = Pa();
  return f ? /* @__PURE__ */ (0, y.jsx)("div", {
    role: "presentation",
    ...g,
    style: {
      ...h,
      ...ZR({
        position: n,
        arrowSize: o,
        arrowOffset: r,
        arrowRadius: i,
        arrowPosition: c,
        dir: w,
        arrowX: d,
        arrowY: m
      })
    }
  }) : null;
}
Xc.displayName = "@mantine/core/FloatingArrow";
function Ah(n, o) {
  if (n === "rtl" && (o.includes("right") || o.includes("left"))) {
    const [r, i] = o.split("-"), c = r === "right" ? "left" : "right";
    return i === void 0 ? c : `${c}-${i}`;
  }
  return o;
}
function KR({ open: n, close: o, openDelay: r, closeDelay: i }) {
  const c = (0, S.useRef)(-1), f = (0, S.useRef)(-1), d = () => {
    window.clearTimeout(c.current), window.clearTimeout(f.current);
  }, m = () => {
    d(), r === 0 || r === void 0 ? n() : c.current = window.setTimeout(n, r);
  }, h = () => {
    d(), i === 0 || i === void 0 ? o() : f.current = window.setTimeout(o, i);
  };
  return (0, S.useEffect)(() => d, []), {
    openDropdown: m,
    closeDropdown: h
  };
}
var j1 = { root: "m_9814e45f" }, FR = { zIndex: Ya("modal") }, D1 = (n, { gradient: o, color: r, backgroundOpacity: i, blur: c, radius: f, zIndex: d }) => ({ root: {
  "--overlay-bg": o || (r !== void 0 || i !== void 0) && Eo(r || "#000", i ?? 0.6) || void 0,
  "--overlay-filter": c ? `blur(${se(c)})` : void 0,
  "--overlay-radius": f === void 0 ? void 0 : St(f),
  "--overlay-z-index": d?.toString()
} }), Ui = Sn((n) => {
  const o = pe("Overlay", FR, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, fixed: h, center: g, children: w, radius: b, zIndex: v, gradient: x, blur: E, color: C, backgroundOpacity: _, mod: R, attributes: M, ...A } = o, O = Me({
    name: "Overlay",
    props: o,
    classes: j1,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: M,
    vars: m,
    varsResolver: D1
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...O("root"),
    mod: [{
      center: g,
      fixed: h
    }, R],
    ...A,
    children: w
  });
});
Ui.classes = j1;
Ui.varsResolver = D1;
Ui.displayName = "@mantine/core/Overlay";
function gm(n) {
  const o = document.createElement("div");
  return o.setAttribute("data-portal", "true"), typeof n.className == "string" && o.classList.add(...n.className.split(" ").filter(Boolean)), typeof n.style == "object" && Object.assign(o.style, n.style), typeof n.id == "string" && o.setAttribute("id", n.id), o;
}
function JR({ target: n, reuseTargetNode: o, ...r }) {
  if (n)
    return typeof n == "string" ? document.querySelector(n) || gm(r) : n;
  if (o) {
    const i = document.querySelector("[data-mantine-shared-portal-node]");
    if (i) return i;
    const c = gm(r);
    return c.setAttribute("data-mantine-shared-portal-node", "true"), document.body.appendChild(c), c;
  }
  return gm(r);
}
var WR = { reuseTargetNode: !0 }, L1 = Ee((n) => {
  const { children: o, target: r, reuseTargetNode: i, ref: c, ...f } = pe("Portal", WR, n), [d, m] = (0, S.useState)(!1), h = (0, S.useRef)(null);
  return Ua(() => (m(!0), h.current = JR({
    target: r,
    reuseTargetNode: i,
    ...f
  }), Rm(c, h.current), !r && !i && h.current && document.body.appendChild(h.current), () => {
    !r && !i && h.current && document.body.removeChild(h.current);
  }), [r]), !d || !h.current ? null : (0, xh.createPortal)(/* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: o }), h.current);
});
L1.displayName = "@mantine/core/Portal";
var vl = Ee(({ withinPortal: n = !0, children: o, ...r }) => ih() === "test" || !n ? /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: o }) : /* @__PURE__ */ (0, y.jsx)(L1, {
  ...r,
  children: o
}));
vl.displayName = "@mantine/core/OptionalPortal";
var xi = (n) => ({
  in: {
    opacity: 1,
    transform: "scale(1)"
  },
  out: {
    opacity: 0,
    transform: `scale(.9) translateY(${n === "bottom" ? 10 : -10}px)`
  },
  transitionProperty: "transform, opacity"
}), Ac = {
  fade: {
    in: { opacity: 1 },
    out: { opacity: 0 },
    transitionProperty: "opacity"
  },
  "fade-up": {
    in: {
      opacity: 1,
      transform: "translateY(0)"
    },
    out: {
      opacity: 0,
      transform: "translateY(30px)"
    },
    transitionProperty: "opacity, transform"
  },
  "fade-down": {
    in: {
      opacity: 1,
      transform: "translateY(0)"
    },
    out: {
      opacity: 0,
      transform: "translateY(-30px)"
    },
    transitionProperty: "opacity, transform"
  },
  "fade-left": {
    in: {
      opacity: 1,
      transform: "translateX(0)"
    },
    out: {
      opacity: 0,
      transform: "translateX(30px)"
    },
    transitionProperty: "opacity, transform"
  },
  "fade-right": {
    in: {
      opacity: 1,
      transform: "translateX(0)"
    },
    out: {
      opacity: 0,
      transform: "translateX(-30px)"
    },
    transitionProperty: "opacity, transform"
  },
  scale: {
    in: {
      opacity: 1,
      transform: "scale(1)"
    },
    out: {
      opacity: 0,
      transform: "scale(0)"
    },
    common: { transformOrigin: "top" },
    transitionProperty: "transform, opacity"
  },
  "scale-y": {
    in: {
      opacity: 1,
      transform: "scaleY(1)"
    },
    out: {
      opacity: 0,
      transform: "scaleY(0)"
    },
    common: { transformOrigin: "top" },
    transitionProperty: "transform, opacity"
  },
  "scale-x": {
    in: {
      opacity: 1,
      transform: "scaleX(1)"
    },
    out: {
      opacity: 0,
      transform: "scaleX(0)"
    },
    common: { transformOrigin: "left" },
    transitionProperty: "transform, opacity"
  },
  "skew-up": {
    in: {
      opacity: 1,
      transform: "translateY(0) skew(0deg, 0deg)"
    },
    out: {
      opacity: 0,
      transform: "translateY(-20px) skew(-10deg, -5deg)"
    },
    common: { transformOrigin: "top" },
    transitionProperty: "transform, opacity"
  },
  "skew-down": {
    in: {
      opacity: 1,
      transform: "translateY(0) skew(0deg, 0deg)"
    },
    out: {
      opacity: 0,
      transform: "translateY(20px) skew(-10deg, -5deg)"
    },
    common: { transformOrigin: "bottom" },
    transitionProperty: "transform, opacity"
  },
  "rotate-left": {
    in: {
      opacity: 1,
      transform: "translateY(0) rotate(0deg)"
    },
    out: {
      opacity: 0,
      transform: "translateY(20px) rotate(-5deg)"
    },
    common: { transformOrigin: "bottom" },
    transitionProperty: "transform, opacity"
  },
  "rotate-right": {
    in: {
      opacity: 1,
      transform: "translateY(0) rotate(0deg)"
    },
    out: {
      opacity: 0,
      transform: "translateY(20px) rotate(5deg)"
    },
    common: { transformOrigin: "top" },
    transitionProperty: "transform, opacity"
  },
  "slide-down": {
    in: {
      opacity: 1,
      transform: "translateY(0)"
    },
    out: {
      opacity: 0,
      transform: "translateY(-100%)"
    },
    common: { transformOrigin: "top" },
    transitionProperty: "transform, opacity"
  },
  "slide-up": {
    in: {
      opacity: 1,
      transform: "translateY(0)"
    },
    out: {
      opacity: 0,
      transform: "translateY(100%)"
    },
    common: { transformOrigin: "bottom" },
    transitionProperty: "transform, opacity"
  },
  "slide-left": {
    in: {
      opacity: 1,
      transform: "translateX(0)"
    },
    out: {
      opacity: 0,
      transform: "translateX(100%)"
    },
    common: { transformOrigin: "left" },
    transitionProperty: "transform, opacity"
  },
  "slide-right": {
    in: {
      opacity: 1,
      transform: "translateX(0)"
    },
    out: {
      opacity: 0,
      transform: "translateX(-100%)"
    },
    common: { transformOrigin: "right" },
    transitionProperty: "transform, opacity"
  },
  pop: {
    ...xi("bottom"),
    common: { transformOrigin: "center center" }
  },
  "pop-bottom-left": {
    ...xi("bottom"),
    common: { transformOrigin: "bottom left" }
  },
  "pop-bottom-right": {
    ...xi("bottom"),
    common: { transformOrigin: "bottom right" }
  },
  "pop-top-left": {
    ...xi("top"),
    common: { transformOrigin: "top left" }
  },
  "pop-top-right": {
    ...xi("top"),
    common: { transformOrigin: "top right" }
  }
}, ob = {
  entering: "in",
  entered: "in",
  exiting: "out",
  exited: "out",
  "pre-exiting": "out",
  "pre-entering": "out"
};
function lb({ transition: n, state: o, duration: r, timingFunction: i }) {
  const c = {
    WebkitBackfaceVisibility: "hidden",
    transitionDuration: `${r}ms`,
    transitionTimingFunction: i
  };
  return typeof n == "string" ? n in Ac ? {
    transitionProperty: Ac[n].transitionProperty,
    ...c,
    ...Ac[n].common,
    ...Ac[n][ob[o]]
  } : {} : {
    transitionProperty: n.transitionProperty,
    ...c,
    ...n.common,
    ...n[ob[o]]
  };
}
function e3({ duration: n, exitDuration: o, timingFunction: r, mounted: i, onEnter: c, onExit: f, onEntered: d, onExited: m, enterDelay: h, exitDelay: g }) {
  const w = Bn(), b = nh(), v = w.respectReducedMotion ? b : !1, [x, E] = (0, S.useState)(v ? 0 : n), [C, _] = (0, S.useState)(i ? "entered" : "exited"), R = (0, S.useRef)(-1), M = (0, S.useRef)(-1), A = (0, S.useRef)(-1);
  function O() {
    window.clearTimeout(R.current), window.clearTimeout(M.current), cancelAnimationFrame(A.current);
  }
  const D = ($) => {
    O();
    const H = $ ? c : f, X = $ ? d : m, J = v ? 0 : $ ? n : o;
    E(J), J === 0 ? (typeof H == "function" && H(), typeof X == "function" && X(), _($ ? "entered" : "exited")) : A.current = requestAnimationFrame(() => {
      xh.flushSync(() => {
        _($ ? "pre-entering" : "pre-exiting");
      }), A.current = requestAnimationFrame(() => {
        typeof H == "function" && H(), _($ ? "entering" : "exiting"), R.current = window.setTimeout(() => {
          typeof X == "function" && X(), _($ ? "entered" : "exited");
        }, J);
      });
    });
  }, j = ($) => {
    if (O(), typeof ($ ? h : g) != "number") {
      D($);
      return;
    }
    M.current = window.setTimeout(() => {
      D($);
    }, $ ? h : g);
  };
  return th(() => {
    j(i);
  }, [i]), (0, S.useEffect)(() => () => {
    O();
  }, []), {
    transitionDuration: x,
    transitionStatus: C,
    transitionTimingFunction: r || "ease"
  };
}
function $a({ keepMounted: n, keepMountedMode: o = "activity", transition: r = "fade", duration: i = 250, exitDuration: c = i, mounted: f, children: d, timingFunction: m = "ease", onExit: h, onEntered: g, onEnter: w, onExited: b, enterDelay: v, exitDelay: x }) {
  const E = ih(), { transitionDuration: C, transitionStatus: _, transitionTimingFunction: R } = e3({
    mounted: f,
    exitDuration: c,
    duration: i,
    timingFunction: m,
    onExit: h,
    onEntered: g,
    onEnter: w,
    onExited: b,
    enterDelay: v,
    exitDelay: x
  });
  if (E === "test") return f ? /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: d({}) }) : n ? d({ display: "none" }) : null;
  if (C === 0)
    return n ? o === "display-none" ? f ? /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: d({}) }) : d({ display: "none" }) : /* @__PURE__ */ (0, y.jsx)(S.Activity, {
      mode: f ? "visible" : "hidden",
      children: d({})
    }) : f ? /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: d({}) }) : null;
  const M = _ === "exited";
  if (n) {
    const A = d(M ? o === "display-none" ? { display: "none" } : {} : lb({
      transition: r,
      duration: C,
      state: _,
      timingFunction: R
    }));
    return o === "display-none" ? A : /* @__PURE__ */ (0, y.jsx)(S.Activity, {
      mode: M ? "hidden" : "visible",
      children: A
    });
  }
  return M ? null : /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: d(lb({
    transition: r,
    duration: C,
    state: _,
    timingFunction: R
  })) });
}
$a.displayName = "@mantine/core/Transition";
var t3 = {
  duration: 100,
  transition: "fade"
};
function rb(n, o) {
  return {
    ...t3,
    ...o,
    ...n
  };
}
var [n3, iu] = Do("Popover component was not found in the tree");
function B1({ childProps: n, disabled: o, opened: r, longPressDelay: i = 500, setReference: c, open: f }) {
  const d = (0, S.useRef)(!1), m = (0, S.useRef)(!1), h = (0, S.useRef)(null), g = (0, S.useRef)(o);
  g.current = o;
  const w = (E, C, _) => {
    c({
      getBoundingClientRect: () => ({
        x: E,
        y: C,
        width: 0,
        height: 0,
        top: C,
        left: E,
        right: E,
        bottom: C,
        toJSON: () => {
        }
      }),
      contextElement: _
    }), f();
  }, b = it(n.onMouseDown, (E) => {
    o || E.button === 2 && E.stopPropagation();
  }), v = it(n.onContextMenu, (E) => {
    o || E.defaultPrevented || (E.preventDefault(), !m.current && (w(E.clientX, E.clientY, E.currentTarget), d.current && (m.current = !0)));
  }), x = jE((E) => {
    if (g.current || m.current) return;
    const C = E, _ = C.touches[0] ?? C.changedTouches[0];
    _ && (w(_.clientX, _.clientY, h.current), m.current = !0);
  }, {
    threshold: i,
    events: ["touch"],
    cancelOnMove: !0,
    onStart: (E) => {
      d.current = !0, m.current = !1, h.current = E.currentTarget;
    },
    onFinish: (E) => {
      d.current = !1, m.current = !1, g.current || E.preventDefault();
    },
    onCancel: () => {
      d.current = !1, m.current = !1;
    }
  });
  return {
    onContextMenu: v,
    onMouseDown: b,
    onTouchStart: it(n.onTouchStart, x.onTouchStart),
    onTouchEnd: it(n.onTouchEnd, x.onTouchEnd),
    onTouchCancel: it(n.onTouchCancel, x.onTouchCancel),
    onTouchMove: it(n.onTouchMove, x.onTouchMove),
    style: o ? n.style : {
      ...n.style,
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none"
    },
    "data-expanded": r ? !0 : void 0
  };
}
function H1(n) {
  const { children: o, disabled: r, longPressDelay: i } = pe("PopoverContextMenu", null, n), c = qa(o);
  if (!c) throw new Error("Popover.ContextMenu component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const f = iu(), d = B1({
    childProps: c.props,
    disabled: r || f.disabled,
    opened: f.opened,
    longPressDelay: i,
    setReference: f.reference,
    open: () => {
      f.opened || f.onToggle();
    }
  });
  return (0, S.cloneElement)(c, d);
}
H1.displayName = "@mantine/core/PopoverContextMenu";
function su({ children: n, active: o = !0, refProp: r = "ref", innerRef: i }) {
  const c = wE(o), f = st(c, i), d = qa(n);
  return d ? (0, S.cloneElement)(d, { [r]: f }) : n;
}
function k1(n) {
  return /* @__PURE__ */ (0, y.jsx)(Rh, {
    tabIndex: -1,
    "data-autofocus": !0,
    ...n
  });
}
su.displayName = "@mantine/core/FocusTrap";
k1.displayName = "@mantine/core/FocusTrapInitialFocus";
su.InitialFocus = k1;
var U1 = {
  dropdown: "m_38a85659",
  arrow: "m_a31dc6c1",
  overlay: "m_3d7bc908"
}, Nh = Ee((n) => {
  const o = pe("PopoverDropdown", null, n), { className: r, style: i, vars: c, children: f, onKeyDownCapture: d, variant: m, classNames: h, styles: g, ref: w, ...b } = o, v = iu(), { dir: x } = Pa(), E = v.arrowPosition === "merge" && v.withArrow ? z1({
    position: v.placement,
    dir: x
  }) : void 0, C = zb({
    opened: v.opened,
    shouldReturnFocus: v.returnFocus
  }), _ = v.withRoles ? {
    "aria-labelledby": v.getTargetId(),
    id: v.getDropdownId(),
    role: "dialog",
    tabIndex: -1
  } : {}, R = st(w, v.floating);
  return v.disabled ? null : /* @__PURE__ */ (0, y.jsx)(vl, {
    ...v.portalProps,
    withinPortal: v.withinPortal,
    children: /* @__PURE__ */ (0, y.jsx)($a, {
      mounted: v.opened,
      ...v.transitionProps,
      transition: v.transitionProps?.transition || "fade",
      duration: v.transitionProps?.duration ?? 150,
      keepMounted: v.keepMounted,
      keepMountedMode: v.keepMountedMode,
      exitDuration: typeof v.transitionProps?.exitDuration == "number" ? v.transitionProps.exitDuration : v.transitionProps?.duration,
      children: (M) => /* @__PURE__ */ (0, y.jsx)(su, {
        active: v.trapFocus && v.opened,
        innerRef: R,
        children: /* @__PURE__ */ (0, y.jsxs)(xe, {
          ..._,
          ...b,
          variant: m,
          onKeyDownCapture: sE(() => {
            v.onClose?.(), v.onDismiss?.();
          }, {
            active: v.closeOnEscape,
            onTrigger: C,
            onKeyDown: d
          }),
          "data-position": v.placement,
          "data-fixed": v.floatingStrategy === "fixed" || void 0,
          ...v.getStyles("dropdown", {
            className: r,
            props: o,
            classNames: h,
            styles: g,
            style: [
              {
                ...M,
                ...E,
                zIndex: v.zIndex,
                top: v.y ?? 0,
                left: v.x ?? 0,
                width: v.width === "target" ? void 0 : se(v.width),
                ...v.referenceHidden ? { display: "none" } : null
              },
              v.resolvedStyles?.dropdown,
              g?.dropdown,
              i
            ]
          }),
          children: [f, /* @__PURE__ */ (0, y.jsx)(Xc, {
            ref: v.arrowRef,
            arrowX: v.arrowX,
            arrowY: v.arrowY,
            visible: v.withArrow,
            position: v.placement,
            arrowSize: v.arrowSize,
            arrowRadius: v.arrowRadius,
            arrowOffset: v.arrowOffset,
            arrowPosition: v.arrowPosition,
            ...v.getStyles("arrow", {
              props: o,
              classNames: h,
              styles: g
            })
          })]
        })
      })
    })
  });
});
Nh.classes = U1;
Nh.displayName = "@mantine/core/PopoverDropdown";
var a3 = {
  refProp: "ref",
  popupType: "dialog"
}, $1 = Ee((n) => {
  const { children: o, refProp: r, popupType: i, ref: c, ...f } = pe("PopoverTarget", a3, n), d = qa(o);
  if (!d) throw new Error("Popover.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const m = f, h = iu(), g = st(h.reference, Zc(d), c), w = h.withRoles ? {
    "aria-haspopup": i,
    "aria-expanded": h.opened,
    "aria-controls": h.opened ? h.getDropdownId() : void 0,
    id: h.getTargetId()
  } : {}, b = d.props;
  return (0, S.cloneElement)(d, {
    ...m,
    ...w,
    ...h.targetProps,
    className: kt(h.targetProps.className, m.className, b.className),
    [r]: g,
    ...h.controlled ? null : { onClick: (v) => {
      h.onToggle(), b.onClick?.(v);
    } }
  });
});
$1.displayName = "@mantine/core/PopoverTarget";
function o3(n) {
  if (n === void 0) return {
    shift: !0,
    flip: !0
  };
  const o = { ...n };
  return n.shift === void 0 && (o.shift = !0), n.flip === void 0 && (o.flip = !0), o;
}
function l3(n, o, r, i) {
  const c = o3(n.middlewares), f = [g1(n.offset), SR()];
  if (c.flip && !r) {
    const d = typeof c.flip == "boolean" ? {} : c.flip, m = i ? {
      fallbackStrategy: "initialPlacement",
      ...d
    } : d;
    f.push(km(m));
  }
  if (c.shift) {
    const d = typeof c.shift == "boolean" ? {} : c.shift;
    f.push(wh((m) => {
      const h = m.placement.startsWith("top") || m.placement.startsWith("bottom");
      return {
        limiter: yR(),
        padding: 5,
        ...n.width === "target" && h ? { mainAxis: !1 } : null,
        ...d
      };
    }));
  }
  return c.inline && f.push(typeof c.inline == "boolean" ? Ti() : Ti(c.inline)), f.push(y1({
    element: n.arrowRef,
    padding: n.arrowOffset
  })), (c.size || n.width === "target") && f.push(bR({
    ...typeof c.size == "boolean" ? {} : c.size,
    apply({ rects: d, availableWidth: m, availableHeight: h, ...g }) {
      const w = o().refs.floating.current?.style ?? {};
      c.size && (typeof c.size == "object" && c.size.apply ? c.size.apply({
        rects: d,
        availableWidth: m,
        availableHeight: h,
        ...g
      }) : Object.assign(w, {
        maxWidth: `${m}px`,
        maxHeight: `${h}px`
      })), n.width === "target" && Object.assign(w, { width: `${d.reference.width}px` });
    }
  })), f;
}
function r3(n) {
  const [o, r] = Kt({
    value: n.opened,
    defaultValue: n.defaultOpened,
    finalValue: !1,
    onChange: n.onChange
  }), i = (0, S.useRef)(o), c = (0, S.useRef)(!1), [f, d] = (0, S.useState)(null), m = n.preventPositionChangeWhenVisible !== !1, h = (0, S.useRef)(o);
  o !== h.current && (h.current = o, o && f !== null && d(null));
  const g = (0, S.useRef)(n.position);
  n.position !== g.current && (g.current = n.position, c.current = !1, f !== null && d(null));
  const w = (0, S.useCallback)(() => d(null), []), b = () => {
    o && !n.disabled && r(!1);
  }, v = () => {
    n.disabled || r(!o);
  }, x = lu({
    open: o,
    strategy: n.strategy,
    placement: m ? f ?? n.position : n.position,
    middleware: l3(n, () => x, m && f !== null, m),
    whileElementsMounted: n.keepMounted ? void 0 : Hm
  });
  (0, S.useEffect)(() => {
    if (!n.keepMounted) return;
    const C = x.refs.reference.current, _ = x.refs.floating.current;
    if (o && C && _) return Hm(C, _, x.update);
  }, [
    n.keepMounted,
    o,
    x.update,
    x.elements.reference,
    x.elements.floating
  ]), Ua(() => {
    if (!o) {
      c.current = !1;
      return;
    }
    if (!m || f !== null) return;
    const C = x.refs.floating.current;
    if (!(!C || C.offsetHeight === 0 || C.offsetWidth === 0)) {
      if (!c.current) {
        c.current = !0, x.update();
        return;
      }
      x.isPositioned && d(x.placement);
    }
  }, [
    m,
    o,
    x.isPositioned,
    x.placement,
    f,
    x.update
  ]);
  const E = (0, S.useRef)(x.placement);
  return Ua(() => {
    E.current !== x.placement && (E.current = x.placement, n.onPositionChange?.(x.placement));
  }, [x.placement]), th(() => {
    o !== i.current && (o ? n.onOpen?.() : n.onClose?.()), i.current = o;
  }, [
    o,
    n.onClose,
    n.onOpen
  ]), {
    floating: x,
    controlled: typeof n.opened == "boolean",
    opened: o,
    onClose: b,
    onToggle: v,
    resetLockedPlacement: w
  };
}
var i3 = {
  position: "bottom",
  offset: 8,
  transitionProps: {
    transition: "fade",
    duration: 150
  },
  middlewares: {
    flip: !0,
    shift: !0,
    inline: !1
  },
  arrowSize: 7,
  arrowOffset: 5,
  arrowRadius: 0,
  arrowPosition: "side",
  closeOnClickOutside: !0,
  withinPortal: !0,
  closeOnEscape: !0,
  trapFocus: !1,
  withRoles: !0,
  returnFocus: !1,
  withOverlay: !1,
  hideDetached: !0,
  preventPositionChangeWhenVisible: !0,
  clickOutsideEvents: ["mousedown", "touchstart"],
  zIndex: Ya("popover"),
  __staticSelector: "Popover",
  width: "max-content"
}, V1 = (n, { radius: o, shadow: r }) => ({ dropdown: {
  "--popover-radius": o === void 0 ? void 0 : St(o),
  "--popover-shadow": eh(r)
} });
function ft(n) {
  const o = pe("Popover", i3, n), { children: r, position: i, offset: c, onPositionChange: f, opened: d, transitionProps: m, onExitTransitionEnd: h, onEnterTransitionEnd: g, width: w, middlewares: b, withArrow: v, arrowSize: x, arrowOffset: E, arrowRadius: C, arrowPosition: _, unstyled: R, classNames: M, styles: A, closeOnClickOutside: O, withinPortal: D, portalProps: j, closeOnEscape: $, clickOutsideEvents: H, trapFocus: X, onClose: J, onDismiss: W, onOpen: ie, onChange: ae, zIndex: q, radius: me, shadow: B, id: G, defaultOpened: k, __staticSelector: I, withRoles: ee, disabled: te, returnFocus: ne, variant: ce, keepMounted: fe, keepMountedMode: N, vars: Z, floatingStrategy: ue, withOverlay: re, overlayProps: ge, hideDetached: he, attributes: ye, preventPositionChangeWhenVisible: ve, ...de } = o, Ne = Me({
    name: I,
    props: o,
    classes: U1,
    classNames: M,
    styles: A,
    unstyled: R,
    attributes: ye,
    rootSelector: "dropdown",
    vars: Z,
    varsResolver: V1
  }), { resolvedStyles: Q } = ki({
    classNames: M,
    styles: A,
    props: o
  }), Se = (0, S.useRef)(null), [_e, Ae] = (0, S.useState)(null), [Oe, We] = (0, S.useState)(null), { dir: ct } = Pa(), tt = ih(), xt = bn(G), Ye = r3({
    middlewares: b,
    width: w,
    position: Ah(ct, i),
    offset: typeof c == "number" ? c + (v ? x / 2 : 0) : c,
    arrowRef: Se,
    arrowOffset: E,
    onPositionChange: f,
    opened: d,
    defaultOpened: k,
    onChange: ae,
    onOpen: ie,
    onClose: J,
    onDismiss: W,
    strategy: ue,
    disabled: te,
    preventPositionChangeWhenVisible: ve,
    keepMounted: fe
  });
  mE(() => {
    O && (Ye.onClose(), W?.());
  }, H, [_e, Oe]);
  const Vt = (0, S.useCallback)((Ft) => {
    Ae(Ft), Ye.floating.refs.setReference(Ft);
  }, [Ye.floating.refs.setReference]), qe = (0, S.useCallback)((Ft) => {
    We(Ft), Ye.floating.refs.setFloating(Ft);
  }, [Ye.floating.refs.setFloating]), ga = (0, S.useCallback)(() => {
    m?.onExited?.(), h?.(), Ye.resetLockedPlacement();
  }, [
    m?.onExited,
    h,
    Ye.resetLockedPlacement
  ]), Xe = (0, S.useCallback)(() => {
    m?.onEntered?.(), g?.();
  }, [m?.onEntered, g]);
  return /* @__PURE__ */ (0, y.jsxs)(n3, {
    value: {
      returnFocus: ne,
      disabled: te,
      controlled: Ye.controlled,
      reference: Vt,
      floating: qe,
      x: Ye.floating.x,
      y: Ye.floating.y,
      arrowX: Ye.floating?.middlewareData?.arrow?.x,
      arrowY: Ye.floating?.middlewareData?.arrow?.y,
      opened: Ye.opened,
      arrowRef: Se,
      transitionProps: {
        ...m,
        onExited: ga,
        onEntered: Xe
      },
      width: w,
      withArrow: v,
      arrowSize: x,
      arrowOffset: E,
      arrowRadius: C,
      arrowPosition: _,
      placement: Ye.floating.placement,
      trapFocus: X,
      withinPortal: D,
      portalProps: j,
      zIndex: q,
      radius: me,
      shadow: B,
      closeOnEscape: $,
      onDismiss: W,
      onClose: Ye.onClose,
      onToggle: Ye.onToggle,
      getTargetId: () => xt,
      getDropdownId: () => `${xt}-dropdown`,
      withRoles: ee,
      targetProps: de,
      __staticSelector: I,
      classNames: M,
      styles: A,
      unstyled: R,
      variant: ce,
      keepMounted: fe,
      keepMountedMode: N,
      getStyles: Ne,
      resolvedStyles: Q,
      floatingStrategy: ue,
      referenceHidden: he && tt !== "test" ? Ye.floating.middlewareData.hide?.referenceHidden : !1
    },
    children: [r, re && /* @__PURE__ */ (0, y.jsx)($a, {
      transition: "fade",
      mounted: Ye.opened,
      duration: m?.duration || 250,
      exitDuration: m?.exitDuration || 250,
      children: (Ft) => /* @__PURE__ */ (0, y.jsx)(vl, {
        withinPortal: D,
        children: /* @__PURE__ */ (0, y.jsx)(Ui, {
          ...ge,
          ...Ne("overlay", {
            className: ge?.className,
            style: [Ft, ge?.style]
          })
        })
      })
    })]
  });
}
ft.Target = $1;
ft.Dropdown = Nh;
ft.ContextMenu = H1;
ft.varsResolver = V1;
ft.displayName = "@mantine/core/Popover";
ft.extend = (n) => n;
ft.withProps = (n) => {
  const o = (r) => /* @__PURE__ */ (0, y.jsx)(ft, {
    ...n,
    ...r
  });
  return o.extend = ft.extend, o.displayName = `WithProps(${ft.displayName})`, o;
};
var In = {
  root: "m_5ae2e3c",
  barsLoader: "m_7a2bd4cd",
  bar: "m_870bb79",
  "bars-loader-animation": "m_5d2b3b9d",
  dotsLoader: "m_4e3f22d7",
  dot: "m_870c4af",
  "loader-dots-animation": "m_aac34a1",
  ovalLoader: "m_b34414df",
  "oval-loader-animation": "m_f8e89c4b"
}, Y1 = ({ className: n, ...o }) => /* @__PURE__ */ (0, y.jsxs)(xe, {
  component: "span",
  className: kt(In.barsLoader, n),
  ...o,
  children: [
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.bar }),
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.bar }),
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.bar })
  ]
});
Y1.displayName = "@mantine/core/Bars";
var q1 = ({ className: n, ...o }) => /* @__PURE__ */ (0, y.jsxs)(xe, {
  component: "span",
  className: kt(In.dotsLoader, n),
  ...o,
  children: [
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.dot }),
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.dot }),
    /* @__PURE__ */ (0, y.jsx)("span", { className: In.dot })
  ]
});
q1.displayName = "@mantine/core/Dots";
var G1 = ({ className: n, ...o }) => /* @__PURE__ */ (0, y.jsx)(xe, {
  component: "span",
  className: kt(In.ovalLoader, n),
  ...o
});
G1.displayName = "@mantine/core/Oval";
var P1 = {
  bars: Y1,
  oval: G1,
  dots: q1
}, s3 = {
  loaders: P1,
  type: "oval"
}, X1 = (n, { size: o, color: r }) => ({ root: {
  "--loader-size": $e(o, "loader-size"),
  "--loader-color": r ? It(r, n) : void 0
} }), pl = Ee((n) => {
  const o = pe("Loader", s3, n), { size: r, color: i, type: c, vars: f, className: d, style: m, classNames: h, styles: g, unstyled: w, loaders: b, variant: v, children: x, attributes: E, ...C } = o, _ = Me({
    name: "Loader",
    props: o,
    classes: In,
    className: d,
    style: m,
    classNames: h,
    styles: g,
    unstyled: w,
    attributes: E,
    vars: f,
    varsResolver: X1
  });
  return x ? /* @__PURE__ */ (0, y.jsx)(xe, {
    ..._("root"),
    ...C,
    children: x
  }) : /* @__PURE__ */ (0, y.jsx)(xe, {
    ..._("root"),
    component: b[c],
    variant: v,
    size: r,
    ...C
  });
});
pl.defaultLoaders = P1;
pl.classes = In;
pl.varsResolver = X1;
pl.displayName = "@mantine/core/Loader";
var xr = {
  root: "m_8d3f4000",
  icon: "m_8d3afb97",
  loader: "m_302b9fb1",
  group: "m_1a0f1b21",
  groupSection: "m_437b6484"
}, c3 = { orientation: "horizontal" }, I1 = (n, { borderWidth: o }) => ({ group: { "--ai-border-width": se(o) } }), cu = Ee((n) => {
  const o = pe("ActionIconGroup", c3, n), { className: r, style: i, classNames: c, styles: f, unstyled: d, orientation: m, vars: h, borderWidth: g, variant: w, mod: b, attributes: v, ...x } = o, E = Me({
    name: "ActionIconGroup",
    props: o,
    classes: xr,
    className: r,
    style: i,
    classNames: c,
    styles: f,
    unstyled: d,
    attributes: v,
    vars: h,
    varsResolver: I1,
    rootSelector: "group"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...E("group"),
    variant: w,
    mod: [{ orientation: m }, b],
    role: "group",
    ...x
  });
});
cu.classes = xr;
cu.varsResolver = I1;
cu.displayName = "@mantine/core/ActionIconGroup";
var Q1 = (n, { radius: o, color: r, gradient: i, variant: c, autoContrast: f, size: d }) => {
  const m = n.variantColorResolver({
    color: r || n.primaryColor,
    theme: n,
    gradient: i,
    variant: c || "filled",
    autoContrast: f
  });
  return { groupSection: {
    "--section-height": $e(d, "section-height"),
    "--section-padding-x": $e(d, "section-padding-x"),
    "--section-fz": Et(d),
    "--section-radius": o === void 0 ? void 0 : St(o),
    "--section-bg": r || c ? m.background : void 0,
    "--section-color": m.color,
    "--section-bd": r || c ? m.border : void 0
  } };
}, uu = Ee((n) => {
  const o = pe("ActionIconGroupSection", null, n), { className: r, style: i, classNames: c, styles: f, unstyled: d, vars: m, variant: h, gradient: g, radius: w, autoContrast: b, attributes: v, ...x } = o, E = Me({
    name: "ActionIconGroupSection",
    props: o,
    classes: xr,
    className: r,
    style: i,
    classNames: c,
    styles: f,
    unstyled: d,
    attributes: v,
    vars: m,
    varsResolver: Q1,
    rootSelector: "groupSection"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...E("groupSection"),
    variant: h,
    ...x
  });
});
uu.classes = xr;
uu.varsResolver = Q1;
uu.displayName = "@mantine/core/ActionIconGroupSection";
var Z1 = (n, { size: o, radius: r, variant: i, gradient: c, color: f, autoContrast: d }) => {
  const m = n.variantColorResolver({
    color: f || n.primaryColor,
    theme: n,
    gradient: c,
    variant: i || "filled",
    autoContrast: d
  });
  return { root: {
    "--ai-size": $e(o, "ai-size"),
    "--ai-radius": r === void 0 ? void 0 : St(r),
    "--ai-bg": f || i ? m.background : void 0,
    "--ai-hover": f || i ? m.hover : void 0,
    "--ai-hover-color": f || i ? m.hoverColor : void 0,
    "--ai-color": m.color,
    "--ai-bd": f || i ? m.border : void 0
  } };
}, jo = Sn((n) => {
  const o = pe("ActionIcon", null, n), { className: r, unstyled: i, variant: c, classNames: f, styles: d, style: m, loading: h, loaderProps: g, size: w, color: b, radius: v, __staticSelector: x, gradient: E, vars: C, children: _, disabled: R, "data-disabled": M, autoContrast: A, mod: O, attributes: D, ...j } = o, $ = Me({
    name: ["ActionIcon", x],
    props: o,
    className: r,
    style: m,
    classes: xr,
    classNames: f,
    styles: d,
    unstyled: i,
    attributes: D,
    vars: C,
    varsResolver: Z1
  });
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    ...$("root", { active: !R && !h && !M }),
    "aria-busy": h || void 0,
    ...j,
    unstyled: i,
    variant: c,
    size: w,
    disabled: R || h,
    mod: [{
      loading: h,
      disabled: R || M
    }, O],
    children: [typeof h == "boolean" && /* @__PURE__ */ (0, y.jsx)($a, {
      mounted: h,
      transition: "slide-down",
      duration: 150,
      children: (H) => /* @__PURE__ */ (0, y.jsx)(xe, {
        component: "span",
        ...$("loader", { style: H }),
        "aria-hidden": !0,
        children: /* @__PURE__ */ (0, y.jsx)(pl, {
          color: "var(--ai-color)",
          size: "calc(var(--ai-size) * 0.55)",
          ...g
        })
      })
    }), /* @__PURE__ */ (0, y.jsx)(xe, {
      component: "span",
      mod: { loading: h },
      ...$("icon"),
      children: _
    })]
  });
});
jo.classes = xr;
jo.varsResolver = Z1;
jo.displayName = "@mantine/core/ActionIcon";
jo.Group = cu;
jo.GroupSection = uu;
function K1({ size: n = "var(--cb-icon-size, 70%)", style: o, ...r }) {
  return /* @__PURE__ */ (0, y.jsx)("svg", {
    viewBox: "0 0 15 15",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      ...o,
      width: n,
      height: n
    },
    ...r,
    children: /* @__PURE__ */ (0, y.jsx)("path", {
      d: "M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z",
      fill: "currentColor",
      fillRule: "evenodd",
      clipRule: "evenodd"
    })
  });
}
K1.displayName = "@mantine/core/CloseIcon";
var F1 = {
  root: "m_86a44da5",
  "root--subtle": "m_220c80f2"
}, u3 = { variant: "subtle" }, J1 = (n, { size: o, radius: r, iconSize: i }) => ({ root: {
  "--cb-size": $e(o, "cb-size"),
  "--cb-radius": r === void 0 ? void 0 : St(r),
  "--cb-icon-size": se(i)
} }), wr = Sn((n) => {
  const o = pe("CloseButton", u3, n), { iconSize: r, children: i, vars: c, radius: f, className: d, classNames: m, style: h, styles: g, unstyled: w, "data-disabled": b, disabled: v, variant: x, icon: E, mod: C, attributes: _, __staticSelector: R, ...M } = o, A = Me({
    name: R || "CloseButton",
    props: o,
    className: d,
    style: h,
    classes: F1,
    classNames: m,
    styles: g,
    unstyled: w,
    attributes: _,
    vars: c,
    varsResolver: J1
  });
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    ...M,
    unstyled: w,
    variant: x,
    disabled: v,
    mod: [{ disabled: v || b }, C],
    ...A("root", {
      variant: x,
      active: !v && !b
    }),
    children: [E || /* @__PURE__ */ (0, y.jsx)(K1, {}), i]
  });
});
wr.classes = F1;
wr.varsResolver = J1;
wr.displayName = "@mantine/core/CloseButton";
function f3(n) {
  return S.Children.toArray(n).filter(Boolean);
}
var W1 = { root: "m_4081bf90" }, d3 = {
  preventGrowOverflow: !0,
  gap: "md",
  align: "center",
  justify: "flex-start",
  wrap: "wrap"
}, eS = (n, { grow: o, preventGrowOverflow: r, gap: i, align: c, justify: f, wrap: d }, { childWidth: m }) => ({ root: {
  "--group-child-width": o && r ? m : void 0,
  "--group-gap": vr(i),
  "--group-align": c,
  "--group-justify": f,
  "--group-wrap": d
} }), fu = Ee((n) => {
  const o = pe("Group", d3, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, children: m, gap: h, align: g, justify: w, wrap: b, grow: v, preventGrowOverflow: x, vars: E, variant: C, __size: _, mod: R, attributes: M, ...A } = o, O = f3(m), D = O.length, j = vr(h ?? "md"), $ = { childWidth: `calc(${100 / D}% - (${j} - ${j} / ${D}))` }, H = Me({
    name: "Group",
    props: o,
    stylesCtx: $,
    className: i,
    style: c,
    classes: W1,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: M,
    vars: E,
    varsResolver: eS
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...H("root"),
    variant: C,
    mod: [{ grow: v }, R],
    size: _,
    ...A,
    children: O
  });
});
fu.classes = W1;
fu.varsResolver = eS;
fu.displayName = "@mantine/core/Group";
var [m3, Qa] = Do("ModalBase component was not found in tree");
function h3({ opened: n, transitionDuration: o }) {
  const [r, i] = (0, S.useState)(n), c = (0, S.useRef)(-1), f = nh() ? 0 : o;
  return (0, S.useEffect)(() => (n ? (i(!0), window.clearTimeout(c.current)) : f === 0 ? i(!1) : c.current = window.setTimeout(() => i(!1), f), () => window.clearTimeout(c.current)), [n, f]), r;
}
function v3({ id: n, transitionProps: o, opened: r, trapFocus: i, closeOnEscape: c, onClose: f, returnFocus: d, handledEscapeEvents: m }) {
  const h = bn(n), [g, w] = (0, S.useState)(!1), [b, v] = (0, S.useState)(!1), x = typeof o?.duration == "number" ? o?.duration : 200, E = h3({
    opened: r,
    transitionDuration: x
  });
  return CE("keydown", (C) => {
    C.key === "Escape" && c && !C.isComposing && r && !m?.has(C) && C.target?.getAttribute("data-mantine-stop-propagation") !== "true" && (m?.add(C), f());
  }, { capture: !0 }), zb({
    opened: r,
    shouldReturnFocus: i && d
  }), {
    _id: h,
    titleMounted: g,
    bodyMounted: b,
    shouldLockScroll: E,
    setTitleMounted: w,
    setBodyMounted: v
  };
}
var ua = function() {
  return ua = Object.assign || function(o) {
    for (var r, i = 1, c = arguments.length; i < c; i++) {
      r = arguments[i];
      for (var f in r) Object.prototype.hasOwnProperty.call(r, f) && (o[f] = r[f]);
    }
    return o;
  }, ua.apply(this, arguments);
};
function tS(n, o) {
  var r = {};
  for (var i in n) Object.prototype.hasOwnProperty.call(n, i) && o.indexOf(i) < 0 && (r[i] = n[i]);
  if (n != null && typeof Object.getOwnPropertySymbols == "function")
    for (var c = 0, i = Object.getOwnPropertySymbols(n); c < i.length; c++) o.indexOf(i[c]) < 0 && Object.prototype.propertyIsEnumerable.call(n, i[c]) && (r[i[c]] = n[i[c]]);
  return r;
}
function p3(n, o, r) {
  if (r || arguments.length === 2)
    for (var i = 0, c = o.length, f; i < c; i++) (f || !(i in o)) && (f || (f = Array.prototype.slice.call(o, 0, i)), f[i] = o[i]);
  return n.concat(f || Array.prototype.slice.call(o));
}
var Hc = "right-scroll-bar-position", kc = "width-before-scroll-bar", g3 = "with-scroll-bars-hidden", y3 = "--removed-body-scroll-bar-size";
function ym(n, o) {
  return typeof n == "function" ? n(o) : n && (n.current = o), n;
}
function b3(n, o) {
  var r = (0, S.useState)(function() {
    return {
      value: n,
      callback: o,
      facade: {
        get current() {
          return r.value;
        },
        set current(i) {
          var c = r.value;
          c !== i && (r.value = i, r.callback(i, c));
        }
      }
    };
  })[0];
  return r.callback = o, r.facade;
}
var S3 = typeof window < "u" ? S.useLayoutEffect : S.useEffect, ib = /* @__PURE__ */ new WeakMap();
function x3(n, o) {
  var r = b3(o || null, function(i) {
    return n.forEach(function(c) {
      return ym(c, i);
    });
  });
  return S3(function() {
    var i = ib.get(r);
    if (i) {
      var c = new Set(i), f = new Set(n), d = r.current;
      c.forEach(function(m) {
        f.has(m) || ym(m, null);
      }), f.forEach(function(m) {
        c.has(m) || ym(m, d);
      });
    }
    ib.set(r, n);
  }, [n]), r;
}
function w3(n) {
  return n;
}
function C3(n, o) {
  o === void 0 && (o = w3);
  var r = [], i = !1;
  return {
    read: function() {
      if (i) throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      return r.length ? r[r.length - 1] : n;
    },
    useMedium: function(c) {
      var f = o(c, i);
      return r.push(f), function() {
        r = r.filter(function(d) {
          return d !== f;
        });
      };
    },
    assignSyncMedium: function(c) {
      for (i = !0; r.length; ) {
        var f = r;
        r = [], f.forEach(c);
      }
      r = {
        push: function(d) {
          return c(d);
        },
        filter: function() {
          return r;
        }
      };
    },
    assignMedium: function(c) {
      i = !0;
      var f = [];
      if (r.length) {
        var d = r;
        r = [], d.forEach(c), f = r;
      }
      var m = function() {
        var g = f;
        f = [], g.forEach(c);
      }, h = function() {
        return Promise.resolve().then(m);
      };
      h(), r = {
        push: function(g) {
          f.push(g), h();
        },
        filter: function(g) {
          return f = f.filter(g), r;
        }
      };
    }
  };
}
function E3(n) {
  n === void 0 && (n = {});
  var o = C3(null);
  return o.options = ua({
    async: !0,
    ssr: !1
  }, n), o;
}
var nS = function(n) {
  var o = n.sideCar, r = tS(n, ["sideCar"]);
  if (!o) throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  var i = o.read();
  if (!i) throw new Error("Sidecar medium not found");
  return S.createElement(i, ua({}, r));
};
nS.isSideCarExport = !0;
function T3(n, o) {
  return n.useMedium(o), nS;
}
var aS = E3(), bm = function() {
}, du = S.forwardRef(function(n, o) {
  var r = S.useRef(null), i = S.useState({
    onScrollCapture: bm,
    onWheelCapture: bm,
    onTouchMoveCapture: bm
  }), c = i[0], f = i[1], d = n.forwardProps, m = n.children, h = n.className, g = n.removeScrollBar, w = n.enabled, b = n.shards, v = n.sideCar, x = n.noRelative, E = n.noIsolation, C = n.inert, _ = n.allowPinchZoom, R = n.as, M = R === void 0 ? "div" : R, A = n.gapMode, O = tS(n, [
    "forwardProps",
    "children",
    "className",
    "removeScrollBar",
    "enabled",
    "shards",
    "sideCar",
    "noRelative",
    "noIsolation",
    "inert",
    "allowPinchZoom",
    "as",
    "gapMode"
  ]), D = v, j = x3([r, o]), $ = ua(ua({}, O), c);
  return S.createElement(S.Fragment, null, w && S.createElement(D, {
    sideCar: aS,
    removeScrollBar: g,
    shards: b,
    noRelative: x,
    noIsolation: E,
    inert: C,
    setCallbacks: f,
    allowPinchZoom: !!_,
    lockRef: r,
    gapMode: A
  }), d ? S.cloneElement(S.Children.only(m), ua(ua({}, $), { ref: j })) : S.createElement(M, ua({}, $, {
    className: h,
    ref: j
  }), m));
});
du.defaultProps = {
  enabled: !0,
  removeScrollBar: !0,
  inert: !1
};
du.classNames = {
  fullWidth: kc,
  zeroRight: Hc
};
var sb, _3 = function() {
  if (sb) return sb;
  if (typeof __webpack_nonce__ < "u") return __webpack_nonce__;
};
function R3() {
  if (!document) return null;
  var n = document.createElement("style");
  n.type = "text/css";
  var o = _3();
  return o && n.setAttribute("nonce", o), n;
}
function A3(n, o) {
  n.styleSheet ? n.styleSheet.cssText = o : n.appendChild(document.createTextNode(o));
}
function N3(n) {
  (document.head || document.getElementsByTagName("head")[0]).appendChild(n);
}
var O3 = function() {
  var n = 0, o = null;
  return {
    add: function(r) {
      n == 0 && (o = R3()) && (A3(o, r), N3(o)), n++;
    },
    remove: function() {
      n--, !n && o && (o.parentNode && o.parentNode.removeChild(o), o = null);
    }
  };
}, M3 = function() {
  var n = O3();
  return function(o, r) {
    S.useEffect(function() {
      return n.add(o), function() {
        n.remove();
      };
    }, [o && r]);
  };
}, oS = function() {
  var n = M3(), o = function(r) {
    var i = r.styles, c = r.dynamic;
    return n(i, c), null;
  };
  return o;
}, z3 = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
}, Sm = function(n) {
  return parseInt(n || "", 10) || 0;
}, j3 = function(n) {
  var o = window.getComputedStyle(document.body), r = o[n === "padding" ? "paddingLeft" : "marginLeft"], i = o[n === "padding" ? "paddingTop" : "marginTop"], c = o[n === "padding" ? "paddingRight" : "marginRight"];
  return [
    Sm(r),
    Sm(i),
    Sm(c)
  ];
}, D3 = function(n) {
  if (n === void 0 && (n = "margin"), typeof window > "u") return z3;
  var o = j3(n), r = document.documentElement.clientWidth, i = window.innerWidth;
  return {
    left: o[0],
    top: o[1],
    right: o[2],
    gap: Math.max(0, i - r + o[2] - o[0])
  };
}, L3 = oS(), _i = "data-scroll-locked", B3 = function(n, o, r, i) {
  var c = n.left, f = n.top, d = n.right, m = n.gap;
  return r === void 0 && (r = "margin"), `
  .`.concat(g3, ` {
   overflow: hidden `).concat(i, `;
   padding-right: `).concat(m, "px ").concat(i, `;
  }
  body[`).concat(_i, `] {
    overflow: hidden `).concat(i, `;
    overscroll-behavior: contain;
    `).concat([
    o && "position: relative ".concat(i, ";"),
    r === "margin" && `
    padding-left: `.concat(c, `px;
    padding-top: `).concat(f, `px;
    padding-right: `).concat(d, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(m, "px ").concat(i, `;
    `),
    r === "padding" && "padding-right: ".concat(m, "px ").concat(i, ";")
  ].filter(Boolean).join(""), `
  }

  .`).concat(Hc, ` {
    right: `).concat(m, "px ").concat(i, `;
  }

  .`).concat(kc, ` {
    margin-right: `).concat(m, "px ").concat(i, `;
  }

  .`).concat(Hc, " .").concat(Hc, ` {
    right: 0 `).concat(i, `;
  }

  .`).concat(kc, " .").concat(kc, ` {
    margin-right: 0 `).concat(i, `;
  }

  body[`).concat(_i, `] {
    `).concat(y3, ": ").concat(m, `px;
  }
`);
}, cb = function() {
  var n = parseInt(document.body.getAttribute("data-scroll-locked") || "0", 10);
  return isFinite(n) ? n : 0;
}, H3 = function() {
  S.useEffect(function() {
    return document.body.setAttribute(_i, (cb() + 1).toString()), function() {
      var n = cb() - 1;
      n <= 0 ? document.body.removeAttribute(_i) : document.body.setAttribute(_i, n.toString());
    };
  }, []);
}, k3 = function(n) {
  var o = n.noRelative, r = n.noImportant, i = n.gapMode, c = i === void 0 ? "margin" : i;
  H3();
  var f = S.useMemo(function() {
    return D3(c);
  }, [c]);
  return S.createElement(L3, { styles: B3(f, !o, c, r ? "" : "!important") });
}, $m = !1;
if (typeof window < "u") try {
  var Nc = Object.defineProperty({}, "passive", { get: function() {
    return $m = !0, !0;
  } });
  window.addEventListener("test", Nc, Nc), window.removeEventListener("test", Nc, Nc);
} catch {
  $m = !1;
}
var ur = $m ? { passive: !1 } : !1, U3 = function(n) {
  return n.tagName === "TEXTAREA";
}, lS = function(n, o) {
  if (!(n instanceof Element)) return !1;
  var r = window.getComputedStyle(n);
  return r[o] !== "hidden" && !(r.overflowY === r.overflowX && !U3(n) && r[o] === "visible");
}, $3 = function(n) {
  return lS(n, "overflowY");
}, V3 = function(n) {
  return lS(n, "overflowX");
}, ub = function(n, o) {
  var r = o.ownerDocument, i = o;
  do {
    if (typeof ShadowRoot < "u" && i instanceof ShadowRoot && (i = i.host), rS(n, i)) {
      var c = iS(n, i);
      if (c[1] > c[2]) return !0;
    }
    i = i.parentNode;
  } while (i && i !== r.body);
  return !1;
}, Y3 = function(n) {
  return [
    n.scrollTop,
    n.scrollHeight,
    n.clientHeight
  ];
}, q3 = function(n) {
  return [
    n.scrollLeft,
    n.scrollWidth,
    n.clientWidth
  ];
}, rS = function(n, o) {
  return n === "v" ? $3(o) : V3(o);
}, iS = function(n, o) {
  return n === "v" ? Y3(o) : q3(o);
}, G3 = function(n, o) {
  return n === "h" && o === "rtl" ? -1 : 1;
}, P3 = function(n, o, r, i, c) {
  var f = G3(n, window.getComputedStyle(o).direction), d = f * i, m = r.target, h = o.contains(m), g = !1, w = d > 0, b = 0, v = 0;
  do {
    if (!m) break;
    var x = iS(n, m), E = x[0], C = x[1] - x[2] - f * E;
    (E || C) && rS(n, m) && (b += C, v += E);
    var _ = m.parentNode;
    m = _ && _.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? _.host : _;
  } while (!h && m !== document.body || h && (o.contains(m) || o === m));
  return (w && (c && Math.abs(b) < 1 || !c && d > b) || !w && (c && Math.abs(v) < 1 || !c && -d > v)) && (g = !0), g;
}, Oc = function(n) {
  return "changedTouches" in n ? [n.changedTouches[0].clientX, n.changedTouches[0].clientY] : [0, 0];
}, fb = function(n) {
  return [n.deltaX, n.deltaY];
}, db = function(n) {
  return n && "current" in n ? n.current : n;
}, X3 = function(n, o) {
  return n[0] === o[0] && n[1] === o[1];
}, I3 = function(n) {
  return `
  .block-interactivity-`.concat(n, ` {pointer-events: none;}
  .allow-interactivity-`).concat(n, ` {pointer-events: all;}
`);
}, Q3 = 0, fr = [];
function Z3(n) {
  var o = S.useRef([]), r = S.useRef([0, 0]), i = S.useRef(), c = S.useState(Q3++)[0], f = S.useState(oS)[0], d = S.useRef(n);
  S.useEffect(function() {
    d.current = n;
  }, [n]), S.useEffect(function() {
    if (n.inert) {
      document.body.classList.add("block-interactivity-".concat(c));
      var C = p3([n.lockRef.current], (n.shards || []).map(db), !0).filter(Boolean);
      return C.forEach(function(_) {
        return _.classList.add("allow-interactivity-".concat(c));
      }), function() {
        document.body.classList.remove("block-interactivity-".concat(c)), C.forEach(function(_) {
          return _.classList.remove("allow-interactivity-".concat(c));
        });
      };
    }
  }, [
    n.inert,
    n.lockRef.current,
    n.shards
  ]);
  var m = S.useCallback(function(C, _) {
    if ("touches" in C && C.touches.length === 2 || C.type === "wheel" && C.ctrlKey) return !d.current.allowPinchZoom;
    var R = Oc(C), M = r.current, A = "deltaX" in C ? C.deltaX : M[0] - R[0], O = "deltaY" in C ? C.deltaY : M[1] - R[1], D, j = C.target, $ = Math.abs(A) > Math.abs(O) ? "h" : "v";
    if ("touches" in C && $ === "h" && j.type === "range") return !1;
    var H = window.getSelection(), X = H && H.anchorNode;
    if (X && (X === j || X.contains(j))) return !1;
    var J = ub($, j);
    if (!J) return !0;
    if (J ? D = $ : (D = $ === "v" ? "h" : "v", J = ub($, j)), !J) return !1;
    if (!i.current && "changedTouches" in C && (A || O) && (i.current = D), !D) return !0;
    var W = i.current || D;
    return P3(W, _, C, W === "h" ? A : O, !0);
  }, []), h = S.useCallback(function(C) {
    var _ = C;
    if (!(!fr.length || fr[fr.length - 1] !== f)) {
      var R = "deltaY" in _ ? fb(_) : Oc(_), M = o.current.filter(function(O) {
        return O.name === _.type && (O.target === _.target || _.target === O.shadowParent) && X3(O.delta, R);
      })[0];
      if (M && M.should) {
        _.cancelable && _.preventDefault();
        return;
      }
      if (!M) {
        var A = (d.current.shards || []).map(db).filter(Boolean).filter(function(O) {
          return O.contains(_.target);
        });
        (A.length > 0 ? m(_, A[0]) : !d.current.noIsolation) && _.cancelable && _.preventDefault();
      }
    }
  }, []), g = S.useCallback(function(C, _, R, M) {
    var A = {
      name: C,
      delta: _,
      target: R,
      should: M,
      shadowParent: K3(R)
    };
    o.current.push(A), setTimeout(function() {
      o.current = o.current.filter(function(O) {
        return O !== A;
      });
    }, 1);
  }, []), w = S.useCallback(function(C) {
    r.current = Oc(C), i.current = void 0;
  }, []), b = S.useCallback(function(C) {
    g(C.type, fb(C), C.target, m(C, n.lockRef.current));
  }, []), v = S.useCallback(function(C) {
    g(C.type, Oc(C), C.target, m(C, n.lockRef.current));
  }, []);
  S.useEffect(function() {
    return fr.push(f), n.setCallbacks({
      onScrollCapture: b,
      onWheelCapture: b,
      onTouchMoveCapture: v
    }), document.addEventListener("wheel", h, ur), document.addEventListener("touchmove", h, ur), document.addEventListener("touchstart", w, ur), function() {
      fr = fr.filter(function(C) {
        return C !== f;
      }), document.removeEventListener("wheel", h, ur), document.removeEventListener("touchmove", h, ur), document.removeEventListener("touchstart", w, ur);
    };
  }, []);
  var x = n.removeScrollBar, E = n.inert;
  return S.createElement(S.Fragment, null, E ? S.createElement(f, { styles: I3(c) }) : null, x ? S.createElement(k3, {
    noRelative: n.noRelative,
    gapMode: n.gapMode
  }) : null);
}
function K3(n) {
  for (var o = null; n !== null; )
    n instanceof ShadowRoot && (o = n.host, n = n.host), n = n.parentNode;
  return o;
}
var F3 = T3(aS, Z3), sS = S.forwardRef(function(n, o) {
  return S.createElement(du, ua({}, n, {
    ref: o,
    sideCar: F3
  }));
});
sS.classNames = du.classNames;
function cS({ keepMounted: n, keepMountedMode: o = "activity", opened: r, onClose: i, id: c, transitionProps: f, onExitTransitionEnd: d, onEnterTransitionEnd: m, trapFocus: h, closeOnEscape: g, returnFocus: w, closeOnClickOutside: b, withinPortal: v, portalProps: x, lockScroll: E, children: C, zIndex: _, shadow: R, padding: M, __vars: A, unstyled: O, removeScrollProps: D, __handledEscapeEvents: j, ...$ }) {
  const { _id: H, titleMounted: X, bodyMounted: J, shouldLockScroll: W, setTitleMounted: ie, setBodyMounted: ae } = v3({
    id: c,
    transitionProps: f,
    opened: r,
    trapFocus: h,
    closeOnEscape: g,
    onClose: i,
    returnFocus: w,
    handledEscapeEvents: j
  }), { key: q, ...me } = D || {};
  return /* @__PURE__ */ (0, y.jsx)(vl, {
    ...x,
    withinPortal: v,
    children: /* @__PURE__ */ (0, y.jsx)(m3, {
      value: {
        opened: r,
        onClose: i,
        closeOnClickOutside: b,
        onExitTransitionEnd: d,
        onEnterTransitionEnd: m,
        transitionProps: {
          ...f,
          keepMounted: n,
          keepMountedMode: o
        },
        getTitleId: () => `${H}-title`,
        getBodyId: () => `${H}-body`,
        titleMounted: X,
        bodyMounted: J,
        setTitleMounted: ie,
        setBodyMounted: ae,
        trapFocus: h,
        closeOnEscape: g,
        zIndex: _,
        unstyled: O
      },
      children: /* @__PURE__ */ (0, y.jsx)(sS, {
        enabled: W && E,
        ...me,
        children: /* @__PURE__ */ (0, y.jsx)(xe, {
          ...$,
          id: H,
          __vars: {
            ...A,
            "--mb-z-index": (_ || Ya("modal")).toString(),
            "--mb-shadow": eh(R),
            "--mb-padding": vr(M)
          },
          children: C
        })
      }, q)
    })
  });
}
cS.displayName = "@mantine/core/ModalBase";
function J3() {
  const n = Qa();
  return (0, S.useEffect)(() => (n.setBodyMounted(!0), () => n.setBodyMounted(!1)), []), n.getBodyId();
}
var pr = {
  title: "m_615af6c9",
  header: "m_b5489c3c",
  inner: "m_60c222c7",
  content: "m_fd1ab0aa",
  close: "m_606cb269",
  body: "m_5df29311"
};
function uS({ className: n, ...o }) {
  const r = J3(), i = Qa();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    id: r,
    className: kt({ [pr.body]: !i.unstyled }, n),
    ...o
  });
}
uS.displayName = "@mantine/core/ModalBaseBody";
function fS({ className: n, onClick: o, ...r }) {
  const i = Qa();
  return /* @__PURE__ */ (0, y.jsx)(wr, {
    ...r,
    onClick: (c) => {
      i.onClose(), o?.(c);
    },
    className: kt({ [pr.close]: !i.unstyled }, n),
    unstyled: i.unstyled
  });
}
fS.displayName = "@mantine/core/ModalBaseCloseButton";
function dS({ transitionProps: n, className: o, innerProps: r, onKeyDown: i, style: c, ref: f, ...d }) {
  const m = Qa();
  return /* @__PURE__ */ (0, y.jsx)($a, {
    mounted: m.opened,
    transition: "pop",
    ...m.transitionProps,
    onExited: () => {
      m.onExitTransitionEnd?.(), m.transitionProps?.onExited?.();
    },
    onEntered: () => {
      m.onEnterTransitionEnd?.(), m.transitionProps?.onEntered?.();
    },
    ...n,
    children: (h) => /* @__PURE__ */ (0, y.jsx)("div", {
      ...r,
      className: kt({ [pr.inner]: !m.unstyled }, r.className),
      children: /* @__PURE__ */ (0, y.jsx)(su, {
        active: m.opened && m.trapFocus,
        innerRef: f,
        children: /* @__PURE__ */ (0, y.jsx)(ru, {
          ...d,
          component: "section",
          role: "dialog",
          tabIndex: -1,
          "aria-modal": !0,
          "aria-describedby": m.bodyMounted ? m.getBodyId() : void 0,
          "aria-labelledby": m.titleMounted ? m.getTitleId() : void 0,
          style: [c, h],
          className: kt({ [pr.content]: !m.unstyled }, o),
          unstyled: m.unstyled,
          children: d.children
        })
      })
    })
  });
}
dS.displayName = "@mantine/core/ModalBaseContent";
function mS({ className: n, ...o }) {
  const r = Qa();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "header",
    className: kt({ [pr.header]: !r.unstyled }, n),
    ...o
  });
}
mS.displayName = "@mantine/core/ModalBaseHeader";
var W3 = {
  duration: 200,
  timingFunction: "ease",
  transition: "fade"
};
function eA(n) {
  const o = Qa();
  return {
    ...W3,
    ...o.transitionProps,
    ...n
  };
}
function hS({ onClick: n, transitionProps: o, style: r, visible: i, ...c }) {
  const f = Qa(), d = eA(o);
  return /* @__PURE__ */ (0, y.jsx)($a, {
    mounted: i !== void 0 ? i : f.opened,
    ...d,
    transition: "fade",
    children: (m) => /* @__PURE__ */ (0, y.jsx)(Ui, {
      fixed: !0,
      style: [r, m],
      zIndex: f.zIndex,
      unstyled: f.unstyled,
      onClick: (h) => {
        n?.(h), f.closeOnClickOutside && f.onClose();
      },
      ...c
    })
  });
}
hS.displayName = "@mantine/core/ModalBaseOverlay";
function tA() {
  const n = Qa();
  return (0, S.useEffect)(() => (n.setTitleMounted(!0), () => n.setTitleMounted(!1)), []), n.getTitleId();
}
function vS({ className: n, ...o }) {
  const r = tA(), i = Qa();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "h2",
    className: kt({ [pr.title]: !i.unstyled }, n),
    id: r,
    ...o
  });
}
vS.displayName = "@mantine/core/ModalBaseTitle";
function nA({ children: n }) {
  return /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: n });
}
var pS = (0, S.createContext)({ size: "sm" }), gS = Ee((n) => {
  const o = pe("InputClearButton", null, n), { size: r, variant: i, vars: c, classNames: f, styles: d, ...m } = o, h = (0, S.use)(pS), { resolvedClassNames: g, resolvedStyles: w } = ki({
    classNames: f,
    styles: d,
    props: o
  });
  return /* @__PURE__ */ (0, y.jsx)(wr, {
    variant: i || "transparent",
    size: r || h?.size || "sm",
    classNames: g,
    styles: w,
    __staticSelector: "InputClearButton",
    style: {
      pointerEvents: "all",
      background: "var(--input-bg)",
      ...m.style
    },
    ...m
  });
});
gS.displayName = "@mantine/core/InputClearButton";
var aA = {
  xs: 7,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 15
};
function oA({ __clearable: n, __clearSection: o, rightSection: r, __defaultRightSection: i, size: c = "sm", __clearSectionMode: f = "both" }) {
  const d = n && o;
  return f === "rightSection" ? r === null ? null : r || i : f === "clear" ? r === null ? null : d || i : d && (r || i) ? /* @__PURE__ */ (0, y.jsxs)("div", {
    "data-combined-clear-section": !0,
    style: {
      display: "flex",
      gap: 2,
      alignItems: "center",
      paddingInlineEnd: aA[c]
    },
    children: [d, r || i]
  }) : r === null ? null : r || d || i;
}
var gl = (0, S.createContext)({
  offsetBottom: !1,
  offsetTop: !1,
  describedBy: void 0,
  getStyles: null,
  inputId: void 0,
  labelId: void 0
}), rn = {
  wrapper: "m_6c018570",
  input: "m_8fb7ebe7",
  bottomSection: "m_93f4ed57",
  section: "m_82577fc2",
  placeholder: "m_88bacfd0",
  root: "m_46b77525",
  label: "m_8fdc1311",
  required: "m_78a94662",
  error: "m_8f816625",
  success: "m_9d9d40e0",
  description: "m_fe47ce59"
}, yS = (n, { size: o }) => ({ description: { "--input-description-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` } }), $i = Ee((n) => {
  const o = pe("InputDescription", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, __staticSelector: h, __inheritStyles: g = !0, attributes: w, ...b } = pe("InputDescription", null, o), v = (0, S.use)(gl), x = Me({
    name: ["InputWrapper", h],
    props: o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: w,
    rootSelector: "description",
    vars: m,
    varsResolver: yS
  }), E = g && v?.getStyles || x;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "p",
    ...E("description", v?.getStyles ? {
      className: i,
      style: c
    } : void 0),
    ...b
  });
});
$i.classes = rn;
$i.varsResolver = yS;
$i.displayName = "@mantine/core/InputDescription";
var bS = (n, { size: o }) => ({ error: { "--input-error-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` } }), Vi = Ee((n) => {
  const o = pe("InputError", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, attributes: h, __staticSelector: g, __inheritStyles: w = !0, ...b } = o, v = Me({
    name: ["InputWrapper", g],
    props: o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: h,
    rootSelector: "error",
    vars: m,
    varsResolver: bS
  }), x = (0, S.use)(gl), E = w && x?.getStyles || v;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "p",
    ...E("error", x?.getStyles ? {
      className: i,
      style: c
    } : void 0),
    ...b
  });
});
Vi.classes = rn;
Vi.varsResolver = bS;
Vi.displayName = "@mantine/core/InputError";
var lA = { labelElement: "label" }, SS = (n, { size: o }) => ({ label: {
  "--input-label-size": Et(o),
  "--input-asterisk-color": void 0
} }), Yi = Ee((n) => {
  const o = pe("InputLabel", lA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, labelElement: h, required: g, htmlFor: w, onMouseDown: b, children: v, __staticSelector: x, mod: E, attributes: C, ..._ } = o, R = Me({
    name: ["InputWrapper", x],
    props: o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: C,
    rootSelector: "label",
    vars: m,
    varsResolver: SS
  }), M = (0, S.use)(gl), A = M?.getStyles || R, O = _.component || h, D = typeof O != "string" || O === "label";
  return /* @__PURE__ */ (0, y.jsxs)(xe, {
    ...A("label", M?.getStyles ? {
      className: i,
      style: c
    } : void 0),
    component: h,
    htmlFor: D ? w : void 0,
    mod: [{ required: g }, E],
    onMouseDown: (j) => {
      b?.(j), !j.defaultPrevented && j.detail > 1 && j.preventDefault();
    },
    ..._,
    children: [v, g && /* @__PURE__ */ (0, y.jsx)("span", {
      ...A("required"),
      "aria-hidden": !0,
      children: " *"
    })]
  });
});
Yi.classes = rn;
Yi.varsResolver = SS;
Yi.displayName = "@mantine/core/InputLabel";
var Oh = Ee((n) => {
  const o = pe("InputPlaceholder", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, __staticSelector: h, error: g, mod: w, attributes: b, ...v } = o, x = Me({
    name: ["InputPlaceholder", h],
    props: o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: b,
    rootSelector: "placeholder"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...x("placeholder"),
    mod: [{ error: !!g }, w],
    component: "span",
    ...v
  });
});
Oh.classes = rn;
Oh.displayName = "@mantine/core/InputPlaceholder";
var xS = (n, { size: o }) => ({ success: { "--input-success-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` } }), qi = Ee((n) => {
  const o = pe("InputSuccess", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, attributes: h, __staticSelector: g, __inheritStyles: w = !0, ...b } = o, v = Me({
    name: ["InputWrapper", g],
    props: o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: h,
    rootSelector: "success",
    vars: m,
    varsResolver: xS
  }), x = (0, S.use)(gl), E = w && x?.getStyles || v;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "p",
    ...E("success", x?.getStyles ? {
      className: i,
      style: c
    } : void 0),
    ...b
  });
});
qi.classes = rn;
qi.varsResolver = xS;
qi.displayName = "@mantine/core/InputSuccess";
function rA(n, { hasDescription: o, hasError: r }) {
  const i = n.findIndex((m) => m === "input"), c = n.slice(0, i), f = n.slice(i + 1), d = o && c.includes("description") || r && c.includes("error");
  return {
    offsetBottom: o && f.includes("description") || r && f.includes("error"),
    offsetTop: d
  };
}
var iA = {
  labelElement: "label",
  inputContainer: (n) => n,
  inputWrapperOrder: [
    "label",
    "description",
    "input",
    "error"
  ]
}, wS = (n, { size: o }) => ({
  label: {
    "--input-label-size": Et(o),
    "--input-asterisk-color": void 0
  },
  error: { "--input-error-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` },
  success: { "--input-success-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` },
  description: { "--input-description-size": o === void 0 ? void 0 : `calc(${Et(o)} - ${se(2)})` }
}), mu = Ee((n) => {
  const o = pe("InputWrapper", iA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, size: h, variant: g, __staticSelector: w, inputContainer: b, inputWrapperOrder: v, label: x, error: E, success: C, description: _, labelProps: R, descriptionProps: M, errorProps: A, successProps: O, labelElement: D, children: j, withAsterisk: $, id: H, required: X, __stylesApiProps: J, mod: W, attributes: ie, ...ae } = o, q = Me({
    name: ["InputWrapper", w],
    props: J || o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: ie,
    vars: m,
    varsResolver: wS
  }), me = {
    size: h,
    variant: g,
    __staticSelector: w
  }, B = bn(H), G = typeof $ == "boolean" ? $ : X, k = A?.id || `${B}-error`, I = O?.id || `${B}-success`, ee = M?.id || `${B}-description`, te = B, ne = !!E && typeof E != "boolean", ce = !!C && typeof C != "boolean" && !E, fe = !!_, N = ne && v.includes("error"), Z = ce && v.includes("error"), ue = fe && v.includes("description"), re = `${N ? k : ""} ${Z ? I : ""} ${ue ? ee : ""}`, ge = re.trim().length > 0 ? re.trim() : void 0, he = R?.id || `${B}-label`, ye = x && /* @__PURE__ */ (0, y.jsx)(Yi, {
    labelElement: D,
    id: he,
    htmlFor: te,
    required: G,
    ...me,
    ...R,
    children: x
  }, "label"), ve = fe && /* @__PURE__ */ (0, y.jsx)($i, {
    ...M,
    ...me,
    size: M?.size || me.size,
    id: M?.id || ee,
    children: _
  }, "description"), de = /* @__PURE__ */ (0, y.jsx)(S.Fragment, { children: b(j) }, "input"), Ne = ne && /* @__PURE__ */ (0, S.createElement)(Vi, {
    ...A,
    ...me,
    size: A?.size || me.size,
    key: "error",
    id: A?.id || k
  }, E), Q = ce && /* @__PURE__ */ (0, S.createElement)(qi, {
    ...O,
    ...me,
    size: O?.size || me.size,
    key: "success",
    id: O?.id || I
  }, C), Se = v.map((_e) => {
    switch (_e) {
      case "label":
        return ye;
      case "input":
        return de;
      case "description":
        return ve;
      case "error":
        return Ne || Q;
      default:
        return null;
    }
  });
  return /* @__PURE__ */ (0, y.jsx)(gl, {
    value: {
      getStyles: q,
      describedBy: ge,
      inputId: te,
      labelId: he,
      ...rA(v, {
        hasDescription: fe,
        hasError: ne || ce
      })
    },
    children: /* @__PURE__ */ (0, y.jsx)(xe, {
      variant: g,
      size: h,
      mod: [{
        error: !!E,
        success: !!C && !E
      }, W],
      id: D === "label" ? void 0 : H,
      ...q("root"),
      ...ae,
      children: Se
    })
  });
});
mu.classes = rn;
mu.varsResolver = wS;
mu.displayName = "@mantine/core/InputWrapper";
var sA = {
  variant: "default",
  leftSectionPointerEvents: "none",
  rightSectionPointerEvents: "none",
  withAria: !0,
  withErrorStyles: !0,
  withSuccessStyles: !0,
  size: "sm",
  loading: !1,
  loadingPosition: "right"
}, CS = (n, o, r) => ({ wrapper: {
  "--input-margin-top": r.offsetTop ? "calc(var(--mantine-spacing-xs) / 2)" : void 0,
  "--input-margin-bottom": r.offsetBottom ? "calc(var(--mantine-spacing-xs) / 2)" : void 0,
  "--input-height": $e(o.size, "input-height"),
  "--input-fz": Et(o.size),
  "--input-radius": o.radius === void 0 ? void 0 : St(o.radius),
  "--input-left-section-width": o.leftSectionWidth !== void 0 ? se(o.leftSectionWidth) : void 0,
  "--input-right-section-width": o.rightSectionWidth !== void 0 ? se(o.rightSectionWidth) : void 0,
  "--input-padding-y": o.multiline ? $e(o.size, "input-padding-y") : void 0,
  "--input-left-section-pointer-events": o.leftSectionPointerEvents,
  "--input-right-section-pointer-events": o.rightSectionPointerEvents
} }), lt = Sn((n) => {
  const o = pe("Input", sA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, required: m, __staticSelector: h, __stylesApiProps: g, size: w, wrapperProps: b, error: v, success: x, disabled: E, leftSection: C, leftSectionProps: _, leftSectionWidth: R, rightSection: M, rightSectionProps: A, rightSectionWidth: O, rightSectionPointerEvents: D, leftSectionPointerEvents: j, variant: $, vars: H, pointer: X, multiline: J, radius: W, id: ie, withAria: ae, withErrorStyles: q, withSuccessStyles: me, mod: B, inputSize: G, attributes: k, __clearSection: I, __clearable: ee, __clearSectionMode: te, __defaultRightSection: ne, loading: ce, loadingPosition: fe, __bottomSection: N, __bottomSectionProps: Z, rootRef: ue, dir: re, ...ge } = o, { styleProps: he, rest: ye } = yr(ge), ve = (0, S.use)(gl), de = {
    offsetBottom: ve?.offsetBottom,
    offsetTop: ve?.offsetTop
  }, Ne = Me({
    name: ["Input", h],
    props: g || o,
    classes: rn,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: k,
    stylesCtx: de,
    rootSelector: "wrapper",
    vars: H,
    varsResolver: CS
  }), Q = ae ? {
    required: m,
    disabled: E,
    "aria-invalid": v ? !0 : void 0,
    "aria-describedby": ve?.describedBy,
    id: ve?.inputId || ie
  } : {}, Se = ce ? /* @__PURE__ */ (0, y.jsx)(pl, { size: fe === "left" ? "calc(var(--input-left-section-size) / 2)" : "calc(var(--input-right-section-size) / 2)" }) : null, _e = ce && fe === "left" ? Se : C, Ae = oA({
    __clearable: ee,
    __clearSection: I,
    rightSection: ce && fe === "right" ? Se : M,
    __defaultRightSection: ne,
    size: w,
    __clearSectionMode: te
  });
  return /* @__PURE__ */ (0, y.jsx)(pS, {
    value: { size: w || "sm" },
    children: /* @__PURE__ */ (0, y.jsxs)(xe, {
      ref: ue,
      dir: re,
      ...Ne("wrapper"),
      ...he,
      ...b,
      mod: [{
        error: !!v && q,
        success: !!x && !v && me,
        pointer: X,
        disabled: E,
        multiline: J,
        withRightSection: !!Ae,
        withLeftSection: !!_e,
        withBottomSection: !!N
      }, B],
      variant: $,
      size: w,
      children: [
        _e && /* @__PURE__ */ (0, y.jsx)("div", {
          ..._,
          "data-position": "left",
          ...Ne("section", {
            className: _?.className,
            style: _?.style
          }),
          children: _e
        }),
        /* @__PURE__ */ (0, y.jsx)(xe, {
          component: "input",
          ...ye,
          ...Q,
          required: m,
          mod: {
            disabled: E,
            error: !!v && q,
            success: !!x && !v && me
          },
          variant: $,
          __size: G,
          ...Ne("input")
        }),
        N && /* @__PURE__ */ (0, y.jsx)("div", {
          ...Z,
          ...Ne("bottomSection", {
            className: Z?.className,
            style: Z?.style
          }),
          children: N
        }),
        Ae && /* @__PURE__ */ (0, y.jsx)("div", {
          ...A,
          "data-position": "right",
          ...Ne("section", {
            className: A?.className,
            style: A?.style
          }),
          children: Ae
        })
      ]
    })
  });
});
lt.classes = rn;
lt.varsResolver = CS;
lt.Wrapper = mu;
lt.Label = Yi;
lt.Error = Vi;
lt.Success = qi;
lt.Description = $i;
lt.Placeholder = Oh;
lt.ClearButton = gS;
lt.displayName = "@mantine/core/Input";
function cA(n, o, r) {
  const i = pe([
    "Input",
    "InputWrapper",
    n
  ], o, r), { label: c, description: f, error: d, success: m, required: h, classNames: g, styles: w, className: b, unstyled: v, __staticSelector: x, __stylesApiProps: E, errorProps: C, successProps: _, labelProps: R, descriptionProps: M, wrapperProps: A, id: O, size: D, style: j, inputContainer: $, inputWrapperOrder: H, withAsterisk: X, variant: J, vars: W, mod: ie, attributes: ae, ...q } = i, { styleProps: me, rest: B } = yr(q), G = {
    label: c,
    description: f,
    error: d,
    success: m,
    required: h,
    classNames: g,
    className: b,
    __staticSelector: x,
    __stylesApiProps: E || i,
    errorProps: C,
    successProps: _,
    labelProps: R,
    descriptionProps: M,
    unstyled: v,
    styles: w,
    size: D,
    style: j,
    inputContainer: $,
    inputWrapperOrder: H,
    withAsterisk: X,
    variant: J,
    id: O,
    mod: ie,
    attributes: ae,
    ...A
  };
  return {
    ...B,
    classNames: g,
    styles: w,
    unstyled: v,
    wrapperProps: {
      ...G,
      ...me
    },
    inputProps: {
      required: h,
      classNames: g,
      styles: w,
      unstyled: v,
      size: D,
      __staticSelector: x,
      __stylesApiProps: E || i,
      error: d,
      success: m,
      variant: J,
      id: O,
      attributes: ae
    }
  };
}
var uA = {
  __staticSelector: "InputBase",
  withAria: !0,
  size: "sm"
}, Za = Sn((n) => {
  const { inputProps: o, wrapperProps: r, ...i } = cA("InputBase", uA, n);
  return /* @__PURE__ */ (0, y.jsx)(lt.Wrapper, {
    ...r,
    children: /* @__PURE__ */ (0, y.jsx)(lt, {
      ...o,
      ...i
    })
  });
});
Za.classes = {
  ...lt.classes,
  ...lt.Wrapper.classes
};
Za.displayName = "@mantine/core/InputBase";
function fA(n, o) {
  if (!o || !n) return !1;
  let r = o.parentNode;
  for (; r != null; ) {
    if (r === n) return !0;
    r = r.parentNode;
  }
  return !1;
}
function dA({ target: n, parent: o, ref: r, displayAfterTransitionEnd: i, onTransitionStart: c, onTransitionEnd: f }) {
  const d = (0, S.useRef)(-1), m = (0, S.useRef)(n), [h, g] = (0, S.useState)(!1), [w, b] = (0, S.useState)(typeof i == "boolean" ? i : !1), v = () => {
    if (!n || !o || !r.current) return;
    const _ = n.getBoundingClientRect(), R = o.getBoundingClientRect(), M = o.offsetWidth === 0 ? 1 : R.width / o.offsetWidth, A = o.offsetHeight === 0 ? 1 : R.height / o.offsetHeight, O = window.getComputedStyle(n), D = window.getComputedStyle(o), j = _o(O.borderTopWidth) + _o(D.borderTopWidth), $ = _o(O.borderLeftWidth) + _o(D.borderLeftWidth), H = {
      top: (_.top - R.top) / A - j,
      left: (_.left - R.left) / M - $,
      width: _.width / M,
      height: _.height / A
    };
    r.current.style.transform = `translateY(${H.top}px) translateX(${H.left}px)`, r.current.style.width = `${H.width}px`, r.current.style.height = `${H.height}px`;
  }, x = () => {
    window.clearTimeout(d.current), r.current && (r.current.style.transitionDuration = "0ms"), v(), d.current = window.setTimeout(() => {
      r.current && (r.current.style.transitionDuration = "");
    }, 30);
  }, E = (0, S.useRef)(null), C = (0, S.useRef)(null);
  return (0, S.useEffect)(() => {
    if (h && m.current !== n && c && c(), m.current = n, v(), n)
      return E.current = new ResizeObserver(x), E.current.observe(n), o && (C.current = new ResizeObserver(x), C.current.observe(o)), () => {
        E.current?.disconnect(), C.current?.disconnect();
      };
  }, [o, n]), (0, S.useEffect)(() => {
    if (o) {
      const _ = (R) => {
        fA(R.target, o) && (x(), b(!1));
      };
      return o.addEventListener("transitionend", _), () => {
        o.removeEventListener("transitionend", _);
      };
    }
  }, [o]), (0, S.useEffect)(() => {
    if (r.current && f) {
      const _ = (R) => {
        R.propertyName === "transform" && f();
      };
      return r.current.addEventListener("transitionend", _), () => {
        r.current?.removeEventListener("transitionend", _);
      };
    }
  }, [f]), RE(() => {
    Bb() !== "test" && g(!0);
  }, 20, { autoInvoke: !0 }), NE((_) => {
    _.forEach((R) => {
      R.type === "attributes" && R.attributeName === "dir" && x();
    });
  }, {
    attributes: !0,
    attributeFilter: ["dir"]
  }, () => document.documentElement), {
    initialized: h,
    hidden: w
  };
}
var ES = { root: "m_96b553a6" }, TS = (n, { transitionDuration: o }, { shouldReduceMotion: r }) => ({ root: { "--transition-duration": n.respectReducedMotion && r ? "0ms" : typeof o == "number" ? `${o}ms` : o || "150ms" } }), hu = Ee((n) => {
  const o = pe("FloatingIndicator", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, target: h, parent: g, transitionDuration: w, mod: b, displayAfterTransitionEnd: v, onTransitionStart: x, onTransitionEnd: E, attributes: C, ref: _, ...R } = o, M = nh(), A = Me({
    name: "FloatingIndicator",
    classes: ES,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: C,
    vars: m,
    varsResolver: TS,
    stylesCtx: { shouldReduceMotion: M }
  }), O = (0, S.useRef)(null), { initialized: D, hidden: j } = dA({
    target: h,
    parent: g,
    ref: O,
    displayAfterTransitionEnd: v,
    onTransitionStart: x,
    onTransitionEnd: E
  }), $ = st(_, O);
  return !h || !g ? null : /* @__PURE__ */ (0, y.jsx)(xe, {
    ref: $,
    mod: [{
      initialized: D,
      hidden: j
    }, b],
    ...A("root"),
    ...R
  });
});
hu.displayName = "@mantine/core/FloatingIndicator";
hu.classes = ES;
hu.varsResolver = TS;
function _S({ style: n, size: o = 16, ...r }) {
  return /* @__PURE__ */ (0, y.jsx)("svg", {
    viewBox: "0 0 15 15",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      ...n,
      width: se(o),
      height: se(o),
      display: "block"
    },
    ...r,
    children: /* @__PURE__ */ (0, y.jsx)("path", {
      d: "M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z",
      fill: "currentColor",
      fillRule: "evenodd",
      clipRule: "evenodd"
    })
  });
}
_S.displayName = "@mantine/core/AccordionChevron";
var RS = {
  root: "m_66836ed3",
  wrapper: "m_a5d60502",
  body: "m_667c2793",
  title: "m_6a03f287",
  label: "m_698f4f23",
  icon: "m_667f2a6a",
  message: "m_7fa78076",
  closeButton: "m_87f54839"
}, AS = (n, { radius: o, color: r, variant: i, autoContrast: c }) => {
  const f = n.variantColorResolver({
    color: r || n.primaryColor,
    theme: n,
    variant: i || "light",
    autoContrast: c
  });
  return { root: {
    "--alert-radius": o === void 0 ? void 0 : St(o),
    "--alert-bg": r || i ? f.background : void 0,
    "--alert-color": f.color,
    "--alert-bd": r || i ? f.border : void 0
  } };
}, No = Ee((n) => {
  const o = pe("Alert", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, radius: h, color: g, title: w, children: b, id: v, icon: x, withCloseButton: E, onClose: C, closeButtonLabel: _, variant: R, autoContrast: M, role: A, attributes: O, ...D } = o, j = Me({
    name: "Alert",
    classes: RS,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: O,
    vars: m,
    varsResolver: AS
  }), $ = bn(v), H = w && `${$}-title` || void 0, X = `${$}-body`;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    id: $,
    ...j("root", { variant: R }),
    variant: R,
    ...D,
    role: A || "alert",
    "aria-describedby": b ? X : void 0,
    "aria-labelledby": w ? H : void 0,
    children: /* @__PURE__ */ (0, y.jsxs)("div", {
      ...j("wrapper"),
      children: [
        x && /* @__PURE__ */ (0, y.jsx)("div", {
          ...j("icon"),
          children: x
        }),
        /* @__PURE__ */ (0, y.jsxs)("div", {
          ...j("body"),
          children: [w && /* @__PURE__ */ (0, y.jsx)("div", {
            ...j("title"),
            "data-with-close-button": E || void 0,
            children: /* @__PURE__ */ (0, y.jsx)("span", {
              id: H,
              ...j("label"),
              children: w
            })
          }), b && /* @__PURE__ */ (0, y.jsx)("div", {
            id: X,
            ...j("message"),
            "data-variant": R,
            children: b
          })]
        }),
        E && /* @__PURE__ */ (0, y.jsx)(wr, {
          ...j("closeButton"),
          onClick: C,
          variant: "transparent",
          size: 16,
          iconSize: 16,
          "aria-label": _,
          unstyled: d
        })
      ]
    })
  });
});
No.classes = RS;
No.varsResolver = AS;
No.displayName = "@mantine/core/Alert";
var NS = { root: "m_b6d8b162" };
function mA(n) {
  if (n === "start") return "start";
  if (n === "end" || n) return "end";
}
var hA = { inherit: !1 }, OS = (n, { variant: o, lineClamp: r, gradient: i, size: c, textWrap: f }) => ({ root: {
  "--text-fz": Et(c),
  "--text-lh": cE(c),
  "--text-gradient": o === "gradient" ? Nm(i, n) : void 0,
  "--text-line-clamp": typeof r == "number" ? r.toString() : void 0,
  "--text-text-wrap": f
} }), Mi = Sn((n) => {
  const o = pe("Text", hA, n), { lineClamp: r, truncate: i, inline: c, inherit: f, gradient: d, span: m, textWrap: h, __staticSelector: g, vars: w, className: b, style: v, classNames: x, styles: E, unstyled: C, variant: _, mod: R, size: M, attributes: A, ...O } = o, D = Me({
    name: ["Text", g],
    props: o,
    classes: NS,
    className: b,
    style: v,
    classNames: x,
    styles: E,
    unstyled: C,
    attributes: A,
    vars: w,
    varsResolver: OS
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...D("root", { focusable: !0 }),
    component: m ? "span" : "p",
    variant: _,
    mod: [{
      truncate: mA(i),
      lineClamp: typeof r == "number",
      inline: c,
      inherit: f
    }, R],
    size: M,
    ...O
  });
});
Mi.classes = NS;
Mi.varsResolver = OS;
Mi.displayName = "@mantine/core/Text";
function MS(n) {
  return typeof n == "string" ? {
    value: n,
    label: n
  } : typeof n == "object" && "value" in n && !("label" in n) ? {
    value: n.value,
    label: `${n.value}`,
    disabled: n.disabled
  } : typeof n == "object" && "group" in n ? {
    group: n.group,
    items: n.items.map((o) => MS(o))
  } : typeof n == "number" || typeof n == "bigint" || typeof n == "boolean" ? {
    value: n,
    label: `${n}`
  } : n;
}
function vA(n) {
  return n ? n.map((o) => MS(o)) : [];
}
function zS(n) {
  return n.reduce((o, r) => "group" in r ? {
    ...o,
    ...zS(r.items)
  } : (o[`${r.value}`] = r, o), {});
}
var Zt = {
  dropdown: "m_88b62a41",
  search: "m_985517d8",
  options: "m_b2821a6e",
  option: "m_92253aa5",
  empty: "m_2530cd1d",
  header: "m_858f94bd",
  footer: "m_82b967cb",
  group: "m_254f3e4f",
  groupLabel: "m_2bb2e9e5",
  chevron: "m_2943220b",
  optionsDropdownOption: "m_390b5f4",
  optionsDropdownCheckIcon: "m_8ee53fc2",
  optionsDropdownCheckPlaceholder: "m_a530ee0a"
}, pA = { error: null }, jS = (n, { size: o, color: r }) => ({ chevron: {
  "--combobox-chevron-size": $e(o, "combobox-chevron-size"),
  "--combobox-chevron-color": r ? It(r, n) : void 0
} }), vu = Ee((n) => {
  const o = pe("ComboboxChevron", pA, n), { size: r, error: i, style: c, className: f, classNames: d, styles: m, unstyled: h, vars: g, attributes: w, mod: b, ...v } = o, x = Me({
    name: "ComboboxChevron",
    classes: Zt,
    props: o,
    style: c,
    className: f,
    classNames: d,
    styles: m,
    unstyled: h,
    vars: g,
    varsResolver: jS,
    attributes: w,
    rootSelector: "chevron"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: "svg",
    ...v,
    ...x("chevron"),
    size: r,
    viewBox: "0 0 15 15",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    mod: [
      "combobox-chevron",
      { error: i },
      b
    ],
    children: /* @__PURE__ */ (0, y.jsx)("path", {
      d: "M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z",
      fill: "currentColor",
      fillRule: "evenodd",
      clipRule: "evenodd"
    })
  });
});
vu.classes = Zt;
vu.varsResolver = jS;
vu.displayName = "@mantine/core/ComboboxChevron";
var [gA, xn] = Do("Combobox component was not found in tree");
function DS({ onMouseDown: n, onClick: o, onClear: r, ...i }) {
  return /* @__PURE__ */ (0, y.jsx)(lt.ClearButton, {
    tabIndex: -1,
    "aria-hidden": !0,
    ...i,
    onMouseDown: (c) => {
      c.preventDefault(), n?.(c);
    },
    onClick: (c) => {
      r(), o?.(c);
    }
  });
}
DS.displayName = "@mantine/core/ComboboxClearButton";
var Mh = Ee((n) => {
  const { classNames: o, styles: r, className: i, style: c, hidden: f, ...d } = pe("ComboboxDropdown", null, n), m = xn();
  return /* @__PURE__ */ (0, y.jsx)(ft.Dropdown, {
    ...d,
    role: "presentation",
    "data-hidden": f || void 0,
    "data-floating-height": m.floatingHeight || void 0,
    ...m.getStyles("dropdown", {
      className: i,
      style: c,
      classNames: o,
      styles: r
    })
  });
});
Mh.classes = Zt;
Mh.displayName = "@mantine/core/ComboboxDropdown";
var yA = { refProp: "ref" }, LS = Ee((n) => {
  const { children: o, refProp: r, ref: i } = pe("ComboboxDropdownTarget", yA, n);
  if (xn(), !Jm(o)) throw new Error("Combobox.DropdownTarget component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  return /* @__PURE__ */ (0, y.jsx)(ft.Target, {
    ref: i,
    refProp: r,
    children: o
  });
});
LS.displayName = "@mantine/core/ComboboxDropdownTarget";
var zh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ComboboxEmpty", null, n), m = xn();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...m.getStyles("empty", {
      className: r,
      classNames: o,
      styles: c,
      style: i
    }),
    ...d
  });
});
zh.classes = Zt;
zh.displayName = "@mantine/core/ComboboxEmpty";
function jh({ onKeyDown: n, onClick: o, withKeyboardNavigation: r, withAriaAttributes: i, withExpandedAttribute: c, targetType: f, autoComplete: d }) {
  const m = xn(), [h, g] = (0, S.useState)(null), w = (x) => {
    if (n?.(x), !m.readOnly && r) {
      if (x.nativeEvent.isComposing) return;
      if (x.nativeEvent.code === "ArrowDown" && (x.preventDefault(), m.store.dropdownOpened ? g(m.store.selectNextOption()) : (m.store.openDropdown("keyboard"), g(m.store.selectActiveOption()), m.store.updateSelectedOptionIndex("selected", { scrollIntoView: !0 }))), x.nativeEvent.code === "ArrowUp" && (x.preventDefault(), m.store.dropdownOpened ? g(m.store.selectPreviousOption()) : (m.store.openDropdown("keyboard"), g(m.store.selectActiveOption()), m.store.updateSelectedOptionIndex("selected", { scrollIntoView: !0 }))), x.nativeEvent.code === "Enter" || x.nativeEvent.code === "NumpadEnter") {
        if (x.nativeEvent.keyCode === 229) return;
        const E = m.store.getSelectedOptionIndex();
        m.store.dropdownOpened && E !== -1 ? (x.preventDefault(), m.store.clickSelectedOption()) : f === "button" && (x.preventDefault(), m.store.openDropdown("keyboard"));
      }
      x.key === "Escape" && m.store.closeDropdown("keyboard"), x.nativeEvent.code === "Space" && f === "button" && (x.preventDefault(), m.store.toggleDropdown("keyboard"));
    }
  };
  return {
    ...i ? {
      ...c ? { role: "combobox" } : {},
      "aria-haspopup": "listbox",
      "aria-expanded": c ? !!(m.store.listId && m.store.dropdownOpened) : void 0,
      "aria-controls": m.store.dropdownOpened && m.store.listId ? m.store.listId : void 0,
      "aria-activedescendant": m.store.dropdownOpened && h || void 0,
      autoComplete: d,
      "data-expanded": m.store.dropdownOpened || void 0,
      "data-mantine-stop-propagation": m.store.dropdownOpened || void 0
    } : {},
    onKeyDown: w,
    onClick: (x) => {
      f === "button" && x.currentTarget.focus(), o?.(x);
    }
  };
}
var bA = {
  refProp: "ref",
  targetType: "input",
  withKeyboardNavigation: !0,
  withAriaAttributes: !0,
  withExpandedAttribute: !1,
  autoComplete: "off"
}, BS = Ee((n) => {
  const { children: o, refProp: r, withKeyboardNavigation: i, withAriaAttributes: c, withExpandedAttribute: f, targetType: d, autoComplete: m, ref: h, ...g } = pe("ComboboxEventsTarget", bA, n), w = qa(o);
  if (!w) throw new Error("Combobox.EventsTarget component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const b = xn(), v = jh({
    targetType: d,
    withAriaAttributes: c,
    withKeyboardNavigation: i,
    withExpandedAttribute: f,
    onKeyDown: w.props.onKeyDown,
    onClick: w.props.onClick,
    autoComplete: m
  });
  return (0, S.cloneElement)(w, {
    ...v,
    ...g,
    [r]: st(h, b.store.targetRef, Zc(w))
  });
});
BS.displayName = "@mantine/core/ComboboxEventsTarget";
var Dh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ComboboxFooter", null, n), m = xn();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...m.getStyles("footer", {
      className: r,
      classNames: o,
      style: i,
      styles: c
    }),
    ...d,
    onMouseDown: (h) => {
      h.preventDefault();
    }
  });
});
Dh.classes = Zt;
Dh.displayName = "@mantine/core/ComboboxFooter";
var Lh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, children: d, label: m, id: h, ...g } = pe("ComboboxGroup", null, n), w = xn(), b = bn(h), v = m != null && m !== !1 && m !== "";
  return /* @__PURE__ */ (0, y.jsxs)(xe, {
    role: "group",
    "aria-labelledby": v ? b : void 0,
    ...w.getStyles("group", {
      className: r,
      classNames: o,
      style: i,
      styles: c
    }),
    ...g,
    children: [v && /* @__PURE__ */ (0, y.jsx)("div", {
      id: b,
      ...w.getStyles("groupLabel", {
        classNames: o,
        styles: c
      }),
      children: m
    }), d]
  });
});
Lh.classes = Zt;
Lh.displayName = "@mantine/core/ComboboxGroup";
var Bh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ComboboxHeader", null, n), m = xn();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...m.getStyles("header", {
      className: r,
      classNames: o,
      style: i,
      styles: c
    }),
    ...d,
    onMouseDown: (h) => {
      h.preventDefault();
    }
  });
});
Bh.classes = Zt;
Bh.displayName = "@mantine/core/ComboboxHeader";
function HS({ value: n, valuesDivider: o = ",", ...r }) {
  return /* @__PURE__ */ (0, y.jsx)("input", {
    type: "hidden",
    value: Array.isArray(n) ? n.join(o) : n ? `${n}` : "",
    ...r
  });
}
HS.displayName = "@mantine/core/ComboboxHiddenInput";
var Hh = Ee((n) => {
  const o = pe("ComboboxOption", null, n), { classNames: r, className: i, style: c, styles: f, vars: d, onClick: m, id: h, active: g, onMouseDown: w, onMouseOver: b, disabled: v, selected: x, mod: E, ...C } = o, _ = xn(), R = (0, S.useId)(), M = h || R;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ..._.getStyles("option", {
      className: i,
      classNames: r,
      styles: f,
      style: c
    }),
    ...C,
    id: M,
    mod: [
      "combobox-option",
      {
        "combobox-active": g,
        "combobox-disabled": v,
        "combobox-selected": x
      },
      E
    ],
    role: "option",
    onClick: (A) => {
      v ? A.preventDefault() : (_.onOptionSubmit?.(o.value, o), m?.(A));
    },
    onMouseDown: (A) => {
      A.preventDefault(), w?.(A);
    },
    onMouseOver: (A) => {
      _.resetSelectionOnOptionHover && _.store.resetSelectedOption(), b?.(A);
    }
  });
});
Hh.classes = Zt;
Hh.displayName = "@mantine/core/ComboboxOption";
var kh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, id: f, onMouseDown: d, labelledBy: m, ...h } = pe("ComboboxOptions", null, n), g = xn(), w = bn(f);
  return (0, S.useEffect)(() => {
    g.store.setListId(w);
  }, [w]), /* @__PURE__ */ (0, y.jsx)(xe, {
    ...g.getStyles("options", {
      className: r,
      style: i,
      classNames: o,
      styles: c
    }),
    ...h,
    id: w,
    role: "listbox",
    "aria-labelledby": m,
    onMouseDown: (b) => {
      b.preventDefault(), d?.(b);
    }
  });
});
kh.classes = Zt;
kh.displayName = "@mantine/core/ComboboxOptions";
var SA = {
  withAriaAttributes: !0,
  withKeyboardNavigation: !0
}, Uh = Ee((n) => {
  const { classNames: o, styles: r, unstyled: i, vars: c, withAriaAttributes: f, onKeyDown: d, onClick: m, withKeyboardNavigation: h, size: g, ref: w, ...b } = pe("ComboboxSearch", SA, n), v = xn(), x = v.getStyles("search"), E = jh({
    targetType: "input",
    withAriaAttributes: f,
    withKeyboardNavigation: h,
    withExpandedAttribute: !1,
    onKeyDown: d,
    onClick: m,
    autoComplete: "off"
  });
  return /* @__PURE__ */ (0, y.jsx)(lt, {
    ref: st(w, v.store.searchRef),
    classNames: [{ input: x.className }, o],
    styles: [{ input: x.style }, r],
    size: g || v.size,
    ...E,
    ...b,
    __staticSelector: "Combobox"
  });
});
Uh.classes = Zt;
Uh.displayName = "@mantine/core/ComboboxSearch";
var xA = {
  refProp: "ref",
  targetType: "input",
  withKeyboardNavigation: !0,
  withAriaAttributes: !0,
  withExpandedAttribute: !1,
  autoComplete: "off"
}, kS = Ee((n) => {
  const { children: o, refProp: r, withKeyboardNavigation: i, withAriaAttributes: c, withExpandedAttribute: f, targetType: d, autoComplete: m, ref: h, ...g } = pe("ComboboxTarget", xA, n), w = qa(o);
  if (!w) throw new Error("Combobox.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const b = xn(), v = jh({
    targetType: d,
    withAriaAttributes: c,
    withKeyboardNavigation: i,
    withExpandedAttribute: f,
    onKeyDown: w.props.onKeyDown,
    onClick: w.props.onClick,
    autoComplete: m
  }), x = (0, S.cloneElement)(w, {
    ...v,
    ...g
  });
  return /* @__PURE__ */ (0, y.jsx)(ft.Target, {
    refProp: r,
    ref: st(h, b.store.targetRef),
    children: x
  });
});
kS.displayName = "@mantine/core/ComboboxTarget";
function wA(n, o, r) {
  for (let i = n - 1; i >= 0; i -= 1) if (!o[i].hasAttribute("data-combobox-disabled")) return i;
  if (r) {
    for (let i = o.length - 1; i > -1; i -= 1) if (!o[i].hasAttribute("data-combobox-disabled")) return i;
  }
  return n;
}
function CA(n, o, r) {
  for (let i = n + 1; i < o.length; i += 1) if (!o[i].hasAttribute("data-combobox-disabled")) return i;
  if (r) {
    for (let i = 0; i < o.length; i += 1) if (!o[i].hasAttribute("data-combobox-disabled")) return i;
  }
  return n;
}
function EA(n) {
  for (let o = 0; o < n.length; o += 1) if (!n[o].hasAttribute("data-combobox-disabled")) return o;
  return -1;
}
function US({ defaultOpened: n, opened: o, onOpenedChange: r, onDropdownClose: i, onDropdownOpen: c, loop: f = !0, scrollBehavior: d = "instant" } = {}) {
  const [m, h] = Kt({
    value: o,
    defaultValue: n,
    finalValue: !1,
    onChange: r
  }), g = (0, S.useRef)(null), w = (0, S.useRef)(-1), b = (0, S.useRef)(null), v = (0, S.useRef)(null), x = (0, S.useRef)(-1), E = (0, S.useRef)(-1), C = (0, S.useRef)(-1), _ = (0, S.useCallback)((B = "unknown") => {
    m || (h(!0), c?.(B));
  }, [
    h,
    c,
    m
  ]), R = (0, S.useCallback)((B = "unknown") => {
    m && (h(!1), i?.(B));
  }, [
    h,
    i,
    m
  ]), M = (0, S.useCallback)((B = "unknown") => {
    m ? R(B) : _(B);
  }, [
    R,
    _,
    m
  ]), A = (0, S.useCallback)(() => {
    const B = sa(v.current);
    jc(`#${g.current} [data-combobox-selected]`, B)?.removeAttribute("data-combobox-selected");
  }, []), O = (0, S.useCallback)((B) => {
    const G = sa(v.current), k = jc(`#${g.current}`, G), I = k ? Da("[data-combobox-option]", k) : null;
    if (!I) return null;
    const ee = B >= I.length ? 0 : B < 0 ? I.length - 1 : B;
    return w.current = ee, I?.[ee] && !I[ee].hasAttribute("data-combobox-disabled") ? (A(), I[ee].setAttribute("data-combobox-selected", "true"), I[ee].scrollIntoView({
      block: "nearest",
      behavior: d
    }), I[ee].id) : null;
  }, [d, A]), D = (0, S.useCallback)(() => {
    const B = sa(v.current), G = jc(`#${g.current} [data-combobox-active]`, B);
    if (G) {
      const k = Da(`#${g.current} [data-combobox-option]`, B).findIndex((I) => I === G);
      return O(k);
    }
    return O(0);
  }, [O]), j = (0, S.useCallback)(() => {
    const B = sa(v.current), G = Da(`#${g.current} [data-combobox-option]`, B);
    return O(CA(w.current, G, f));
  }, [O, f]), $ = (0, S.useCallback)(() => {
    const B = sa(v.current), G = Da(`#${g.current} [data-combobox-option]`, B);
    return O(wA(w.current, G, f));
  }, [O, f]), H = (0, S.useCallback)(() => {
    const B = sa(v.current), G = Da(`#${g.current} [data-combobox-option]`, B);
    return O(EA(G));
  }, [O]), X = (0, S.useCallback)((B = "selected", G) => {
    if (typeof B == "number") {
      w.current = B;
      const k = sa(v.current), I = Da(`#${g.current} [data-combobox-option]`, k);
      G?.scrollIntoView && I[B]?.scrollIntoView({
        block: "nearest",
        behavior: d
      });
      return;
    }
    C.current = window.setTimeout(() => {
      const k = sa(v.current), I = Da(`#${g.current} [data-combobox-option]`, k), ee = I.findIndex((te) => te.hasAttribute(`data-combobox-${B}`));
      w.current = ee, G?.scrollIntoView && I[ee]?.scrollIntoView({
        block: "nearest",
        behavior: d
      });
    }, 0);
  }, []), J = (0, S.useCallback)(() => {
    w.current = -1, A();
  }, [A]), W = (0, S.useCallback)(() => {
    const B = sa(v.current);
    Da(`#${g.current} [data-combobox-option]`, B)?.[w.current]?.click();
  }, []), ie = (0, S.useCallback)((B) => {
    g.current = B;
  }, []), ae = (0, S.useCallback)(() => {
    x.current = window.setTimeout(() => b.current?.focus(), 0);
  }, []), q = (0, S.useCallback)(() => {
    E.current = window.setTimeout(() => v.current?.focus(), 0);
  }, []), me = (0, S.useCallback)(() => w.current, []);
  return (0, S.useEffect)(() => () => {
    window.clearTimeout(x.current), window.clearTimeout(E.current), window.clearTimeout(C.current);
  }, []), {
    dropdownOpened: m,
    openDropdown: _,
    closeDropdown: R,
    toggleDropdown: M,
    selectedOptionIndex: w.current,
    getSelectedOptionIndex: me,
    selectOption: O,
    selectFirstOption: H,
    selectActiveOption: D,
    selectNextOption: j,
    selectPreviousOption: $,
    resetSelectedOption: J,
    updateSelectedOptionIndex: X,
    listId: g.current,
    setListId: ie,
    clickSelectedOption: W,
    searchRef: b,
    focusSearchInput: ae,
    targetRef: v,
    focusTarget: q
  };
}
var TA = {
  keepMounted: !0,
  keepMountedMode: "display-none",
  withinPortal: !0,
  resetSelectionOnOptionHover: !1,
  width: "target",
  transitionProps: {
    transition: "fade",
    duration: 0
  },
  size: "sm"
}, $S = (n, { size: o, dropdownPadding: r }) => ({
  options: {
    "--combobox-option-fz": Et(o),
    "--combobox-option-padding": $e(o, "combobox-option-padding")
  },
  dropdown: {
    "--combobox-padding": r === void 0 ? void 0 : se(r),
    "--combobox-option-fz": Et(o),
    "--combobox-option-padding": $e(o, "combobox-option-padding")
  }
}), Fe = (n) => {
  const o = pe("Combobox", TA, n), { classNames: r, styles: i, unstyled: c, children: f, store: d, vars: m, onOptionSubmit: h, onClose: g, size: w, dropdownPadding: b, resetSelectionOnOptionHover: v, __staticSelector: x, readOnly: E, attributes: C, floatingHeight: _, middlewares: R, ...M } = o, A = _ === "viewport" ? {
    ...R,
    flip: !1,
    size: {
      ...typeof R?.size == "object" ? R.size : {},
      padding: typeof R?.size == "object" && R.size.padding !== void 0 ? R.size.padding : 10,
      apply: ({ availableHeight: H, availableWidth: X, elements: J, ...W }) => {
        J.floating.style.setProperty("--combobox-floating-max-height", `${H}px`);
        const ie = R?.size;
        typeof ie == "object" && ie.apply ? ie.apply({
          availableHeight: H,
          availableWidth: X,
          elements: J,
          ...W
        }) : ie && Object.assign(J.floating.style, {
          maxWidth: `${X}px`,
          maxHeight: `${H}px`
        });
      }
    }
  } : R, O = US(), D = d || O, j = Me({
    name: x || "Combobox",
    classes: Zt,
    props: o,
    classNames: r,
    styles: i,
    unstyled: c,
    attributes: C,
    vars: m,
    varsResolver: $S
  }), $ = () => {
    g?.(), D.closeDropdown();
  };
  return /* @__PURE__ */ (0, y.jsx)(gA, {
    value: {
      getStyles: j,
      store: D,
      onOptionSubmit: h,
      size: w,
      resetSelectionOnOptionHover: v,
      readOnly: E,
      floatingHeight: _
    },
    children: /* @__PURE__ */ (0, y.jsx)(ft, {
      opened: D.dropdownOpened,
      ...M,
      middlewares: A,
      onChange: (H) => !H && $(),
      withRoles: !1,
      unstyled: c,
      children: f
    })
  });
}, _A = (n) => n;
Fe.extend = _A;
Fe.classes = Zt;
Fe.varsResolver = $S;
Fe.displayName = "@mantine/core/Combobox";
Fe.Target = kS;
Fe.Dropdown = Mh;
Fe.Options = kh;
Fe.Option = Hh;
Fe.Search = Uh;
Fe.Empty = zh;
Fe.Chevron = vu;
Fe.Footer = Dh;
Fe.Header = Bh;
Fe.EventsTarget = BS;
Fe.DropdownTarget = LS;
Fe.Group = Lh;
Fe.ClearButton = DS;
Fe.HiddenInput = HS;
function VS({ children: n, role: o }) {
  const r = (0, S.use)(gl);
  return r ? /* @__PURE__ */ (0, y.jsx)("div", {
    role: o,
    "aria-labelledby": r.labelId,
    "aria-describedby": r.describedBy,
    children: n
  }) : /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: n });
}
var $h = (0, S.createContext)(null), RA = { hiddenInputValuesSeparator: "," }, Vh = Kc(((n) => {
  const { value: o, defaultValue: r, onChange: i, size: c, wrapperProps: f, children: d, readOnly: m, name: h, hiddenInputValuesSeparator: g, hiddenInputProps: w, maxSelectedValues: b, disabled: v, ...x } = pe("CheckboxGroup", RA, n), [E, C] = Kt({
    value: o,
    defaultValue: r,
    finalValue: [],
    onChange: i
  }), _ = (A) => {
    const O = typeof A == "string" ? A : A.currentTarget.value;
    if (m) return;
    const D = E.includes(O);
    !D && b && E.length >= b || C(D ? E.filter((j) => j !== O) : [...E, O]);
  }, R = (A) => {
    if (v) return !0;
    if (!b) return !1;
    const O = E.includes(A), D = E.length >= b;
    return !O && D;
  }, M = E.join(g);
  return /* @__PURE__ */ (0, y.jsx)($h, {
    value: {
      value: E,
      onChange: _,
      size: c,
      isDisabled: R
    },
    children: /* @__PURE__ */ (0, y.jsxs)(lt.Wrapper, {
      size: c,
      ...f,
      ...x,
      labelElement: "div",
      __staticSelector: "CheckboxGroup",
      children: [/* @__PURE__ */ (0, y.jsx)(VS, {
        role: "group",
        children: d
      }), /* @__PURE__ */ (0, y.jsx)("input", {
        type: "hidden",
        name: h,
        value: M,
        ...w
      })]
    })
  });
}));
Vh.classes = lt.Wrapper.classes;
Vh.displayName = "@mantine/core/CheckboxGroup";
var YS = { card: "m_26775b0a" }, qS = (0, S.createContext)(null), AA = { withBorder: !0 }, GS = (n, { radius: o }) => ({ card: { "--card-radius": St(o) } }), pu = Ee((n) => {
  const o = pe("CheckboxCard", AA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, checked: h, mod: g, withBorder: w, value: b, onClick: v, defaultChecked: x, onChange: E, indeterminate: C, attributes: _, ...R } = o, M = Me({
    name: "CheckboxCard",
    classes: YS,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: _,
    vars: m,
    varsResolver: GS,
    rootSelector: "card"
  }), A = (0, S.use)($h), O = typeof h == "boolean" ? h : A ? A.value.includes(b || "") : void 0, [D, j] = Kt({
    value: O,
    defaultValue: x,
    finalValue: !1,
    onChange: E
  });
  return /* @__PURE__ */ (0, y.jsx)(qS, {
    value: {
      checked: D,
      indeterminate: C
    },
    children: /* @__PURE__ */ (0, y.jsx)(Ia, {
      mod: [{
        "with-border": w,
        checked: D,
        indeterminate: C
      }, g],
      ...M("card"),
      ...R,
      role: "checkbox",
      "aria-checked": C ? "mixed" : D,
      onClick: ($) => {
        v?.($), A?.onChange(b || ""), j(!D);
      }
    })
  });
});
pu.displayName = "@mantine/core/CheckboxCard";
pu.classes = YS;
pu.varsResolver = GS;
function Yh({ size: n, style: o, ...r }) {
  const i = n !== void 0 ? {
    width: se(n),
    height: se(n),
    ...o
  } : o;
  return /* @__PURE__ */ (0, y.jsx)("svg", {
    viewBox: "0 0 10 7",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: i,
    "aria-hidden": !0,
    ...r,
    children: /* @__PURE__ */ (0, y.jsx)("path", {
      d: "M4 4.586L1.707 2.293A1 1 0 1 0 .293 3.707l3 3a.997.997 0 0 0 1.414 0l5-5A1 1 0 1 0 8.293.293L4 4.586z",
      fill: "currentColor",
      fillRule: "evenodd",
      clipRule: "evenodd"
    })
  });
}
function PS({ indeterminate: n, ...o }) {
  return n ? /* @__PURE__ */ (0, y.jsx)("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 32 6",
    "aria-hidden": !0,
    ...o,
    children: /* @__PURE__ */ (0, y.jsx)("rect", {
      width: "32",
      height: "6",
      fill: "currentColor",
      rx: "3"
    })
  }) : /* @__PURE__ */ (0, y.jsx)(Yh, { ...o });
}
var XS = {
  indicator: "m_5e5256ee",
  icon: "m_1b1c543a",
  "indicator--outline": "m_76e20374"
}, NA = {
  icon: PS,
  variant: "filled",
  radius: "sm"
}, IS = (n, { radius: o, color: r, size: i, iconColor: c, variant: f, autoContrast: d }) => {
  const m = pa({
    color: r || n.primaryColor,
    theme: n
  }), h = m.isThemeColor && m.shade === void 0 ? `var(--mantine-color-${m.color}-outline)` : m.color;
  return { indicator: {
    "--checkbox-size": $e(i, "checkbox-size"),
    "--checkbox-radius": o === void 0 ? void 0 : St(o),
    "--checkbox-color": f === "outline" ? h : It(r, n),
    "--checkbox-icon-color": c ? It(c, n) : Ub(d, n) ? Hi({
      color: r,
      theme: n,
      autoContrast: d
    }) : void 0
  } };
}, gu = Ee((n) => {
  const o = pe("CheckboxIndicator", NA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, icon: h, indeterminate: g, radius: w, color: b, iconColor: v, autoContrast: x, checked: E, mod: C, variant: _, disabled: R, attributes: M, ...A } = o, O = Me({
    name: "CheckboxIndicator",
    classes: XS,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: M,
    vars: m,
    varsResolver: IS,
    rootSelector: "indicator"
  }), D = (0, S.use)(qS), j = typeof g == "boolean" ? g : D?.indeterminate, $ = typeof E == "boolean" || typeof g == "boolean" ? E || g : D?.checked || D?.indeterminate || !1;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...O("indicator", { variant: _ }),
    variant: _,
    mod: [{
      checked: $,
      disabled: R
    }, C],
    ...A,
    children: /* @__PURE__ */ (0, y.jsx)(h, {
      indeterminate: j,
      ...O("icon")
    })
  });
});
gu.displayName = "@mantine/core/CheckboxIndicator";
gu.classes = XS;
gu.varsResolver = IS;
var QS = {
  root: "m_5f75b09e",
  body: "m_5f6e695e",
  labelWrapper: "m_d3ea56bb",
  label: "m_8ee546b8",
  description: "m_328f68c0",
  error: "m_8e8a99cc"
}, ZS = QS;
function qh({ __staticSelector: n, __stylesApiProps: o, className: r, classNames: i, styles: c, unstyled: f, children: d, label: m, description: h, id: g, disabled: w, error: b, size: v, labelPosition: x = "left", bodyElement: E = "div", labelElement: C = "label", variant: _, style: R, vars: M, mod: A, attributes: O, ...D }) {
  const j = Me({
    name: n,
    props: o,
    className: r,
    style: R,
    classes: QS,
    classNames: i,
    styles: c,
    unstyled: f,
    attributes: O
  }), $ = h ? `${g}-description` : void 0, H = b && typeof b != "boolean" ? `${g}-error` : void 0;
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...j("root"),
    __vars: {
      "--label-fz": Et(v),
      "--label-lh": $e(v, "label-lh")
    },
    mod: [{ "label-position": x }, A],
    variant: _,
    size: v,
    ...D,
    children: /* @__PURE__ */ (0, y.jsxs)(xe, {
      component: E,
      htmlFor: E === "label" ? g : void 0,
      ...j("body"),
      children: [d, /* @__PURE__ */ (0, y.jsxs)("div", {
        ...j("labelWrapper"),
        "data-disabled": w || void 0,
        children: [
          m && /* @__PURE__ */ (0, y.jsx)(xe, {
            component: C,
            htmlFor: C === "label" ? g : void 0,
            ...j("label"),
            "data-disabled": w || void 0,
            children: m
          }),
          h && /* @__PURE__ */ (0, y.jsx)(lt.Description, {
            id: $,
            size: v,
            __inheritStyles: !1,
            ...j("description"),
            children: h
          }),
          b && typeof b != "boolean" && /* @__PURE__ */ (0, y.jsx)(lt.Error, {
            id: H,
            size: v,
            __inheritStyles: !1,
            ...j("error"),
            children: b
          })
        ]
      })]
    })
  });
}
qh.displayName = "@mantine/core/InlineInput";
var KS = {
  root: "m_bf2d988c",
  inner: "m_26062bec",
  input: "m_26063560",
  icon: "m_bf295423",
  "input--outline": "m_215c4542"
}, OA = {
  labelPosition: "right",
  icon: PS,
  withErrorStyles: !0,
  variant: "filled",
  radius: "sm"
}, FS = (n, { radius: o, color: r, size: i, iconColor: c, variant: f, autoContrast: d }) => {
  const m = pa({
    color: r || n.primaryColor,
    theme: n
  }), h = m.isThemeColor && m.shade === void 0 ? `var(--mantine-color-${m.color}-outline)` : m.color;
  return { root: {
    "--checkbox-size": $e(i, "checkbox-size"),
    "--checkbox-radius": o === void 0 ? void 0 : St(o),
    "--checkbox-color": f === "outline" ? h : It(r, n),
    "--checkbox-icon-color": c ? It(c, n) : Ub(d, n) ? Hi({
      color: r,
      theme: n,
      autoContrast: d
    }) : void 0
  } };
}, ka = Ee((n) => {
  const o = pe("Checkbox", OA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, color: h, label: g, id: w, size: b, radius: v, wrapperProps: x, checked: E, labelPosition: C, description: _, error: R, disabled: M, variant: A, indeterminate: O, icon: D, rootRef: j, iconColor: $, onChange: H, autoContrast: X, mod: J, attributes: W, readOnly: ie, onClick: ae, withErrorStyles: q, ref: me, ...B } = o, G = (0, S.useRef)(null), k = (0, S.use)($h), I = b || k?.size, ee = Me({
    name: "Checkbox",
    props: o,
    classes: KS,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: W,
    vars: m,
    varsResolver: FS
  }), { styleProps: te, rest: ne } = yr(B), ce = bn(w), fe = [
    _ ? `${ce}-description` : void 0,
    R && typeof R != "boolean" ? `${ce}-error` : void 0,
    ne["aria-describedby"]
  ].filter(Boolean).join(" ") || void 0, N = {
    checked: k?.value.includes(ne.value) ?? E,
    onChange: (re) => {
      ie || (k?.onChange(re), H?.(re));
    }
  }, Z = k?.isDisabled?.(ne.value) ?? !1, ue = M || Z;
  return (0, S.useEffect)(() => {
    G.current && (G.current.indeterminate = O || !1, O ? G.current.setAttribute("data-indeterminate", "true") : G.current.removeAttribute("data-indeterminate"));
  }, [O]), /* @__PURE__ */ (0, y.jsx)(qh, {
    ...ee("root"),
    __staticSelector: "Checkbox",
    __stylesApiProps: o,
    id: ce,
    size: I,
    labelPosition: C,
    label: g,
    description: _,
    error: R,
    disabled: ue,
    classNames: r,
    styles: f,
    unstyled: d,
    "data-checked": N.checked || E || void 0,
    variant: A,
    ref: j,
    mod: J,
    attributes: W,
    inert: ne.inert,
    ...te,
    ...x,
    children: /* @__PURE__ */ (0, y.jsxs)(xe, {
      ...ee("inner"),
      mod: { labelPosition: C },
      children: [/* @__PURE__ */ (0, y.jsx)(xe, {
        component: "input",
        id: ce,
        ref: st(G, me),
        mod: {
          error: !!R,
          "with-error-styles": q
        },
        ...ee("input", {
          focusable: !0,
          variant: A
        }),
        ...ne,
        ...N,
        "aria-describedby": fe,
        disabled: ue,
        inert: ne.inert,
        type: "checkbox",
        onClick: (re) => {
          ie && N.checked === void 0 && re.preventDefault(), ae?.(re);
        }
      }), /* @__PURE__ */ (0, y.jsx)(D, {
        indeterminate: O,
        ...ee("icon")
      })]
    })
  });
});
ka.classes = {
  ...KS,
  ...ZS
};
ka.varsResolver = FS;
ka.displayName = "@mantine/core/Checkbox";
ka.Group = Vh;
ka.Indicator = gu;
ka.Card = pu;
function zi(n) {
  return "group" in n;
}
function JS({ options: n, search: o, limit: r }) {
  const i = o.trim().toLowerCase(), c = [];
  for (let f = 0; f < n.length; f += 1) {
    const d = n[f];
    if (c.length === r) return c;
    zi(d) && c.push({
      group: d.group,
      items: JS({
        options: d.items,
        search: o,
        limit: r - c.length
      })
    }), zi(d) || d.label.toLowerCase().includes(i) && c.push(d);
  }
  return c;
}
function MA(n) {
  if (n.length === 0) return !0;
  for (const o of n)
    if (!("group" in o) || o.items.length > 0) return !1;
  return !0;
}
function WS(n, o = /* @__PURE__ */ new Set()) {
  if (Array.isArray(n))
    for (const r of n) if (zi(r)) WS(r.items, o);
    else {
      if (typeof r.value > "u") throw new Error("[@mantine/core] Each option must have value property");
      if (o.has(r.value)) throw new Error(`[@mantine/core] Duplicate options are not supported. Option with value "${r.value}" was provided more than once`);
      o.add(r.value);
    }
}
function zA(n, o) {
  return Array.isArray(n) ? n.includes(o) : n === o;
}
function ex({ data: n, withCheckIcon: o, withAlignedLabels: r, value: i, checkIconPosition: c, unstyled: f, renderOption: d }) {
  if (!zi(n)) {
    const h = zA(i, n.value), g = o && (h ? /* @__PURE__ */ (0, y.jsx)(Yh, { className: Zt.optionsDropdownCheckIcon }) : r ? /* @__PURE__ */ (0, y.jsx)("div", { className: Zt.optionsDropdownCheckPlaceholder }) : null), w = /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
      c === "left" && g,
      /* @__PURE__ */ (0, y.jsx)("span", { children: n.label }),
      c === "right" && g
    ] });
    return /* @__PURE__ */ (0, y.jsx)(Fe.Option, {
      value: n.value,
      disabled: n.disabled,
      className: kt({ [Zt.optionsDropdownOption]: !f }),
      "data-reverse": c === "right" || void 0,
      "data-checked": h || void 0,
      "aria-selected": h,
      active: h,
      children: typeof d == "function" ? d({
        option: n,
        checked: h
      }) : w
    });
  }
  const m = n.items.map((h) => /* @__PURE__ */ (0, y.jsx)(ex, {
    data: h,
    value: i,
    unstyled: f,
    withCheckIcon: o,
    withAlignedLabels: r,
    checkIconPosition: c,
    renderOption: d
  }, `${h.value}`));
  return /* @__PURE__ */ (0, y.jsx)(Fe.Group, {
    label: n.group,
    children: m
  });
}
function jA({ data: n, hidden: o, hiddenWhenEmpty: r, filter: i, search: c, limit: f, maxDropdownHeight: d, floatingHeight: m, withScrollArea: h = !0, filterOptions: g = !0, withCheckIcon: w = !1, withAlignedLabels: b = !1, value: v, checkIconPosition: x, nothingFoundMessage: E, unstyled: C, labelId: _, renderOption: R, scrollAreaProps: M, "aria-label": A }) {
  const O = xn();
  WS(n);
  const D = typeof c == "string" ? (i || JS)({
    options: n,
    search: g ? c : "",
    limit: f ?? 1 / 0
  }) : n, j = MA(D), $ = D.map((H, X) => /* @__PURE__ */ (0, y.jsx)(ex, {
    data: H,
    withCheckIcon: w,
    withAlignedLabels: b,
    value: v,
    checkIconPosition: x,
    unstyled: C,
    renderOption: R
  }, zi(H) ? `group-${typeof H.group == "string" ? H.group : X}` : `${H.value}`));
  return /* @__PURE__ */ (0, y.jsx)(Fe.Dropdown, {
    hidden: o || r && j,
    "data-composed": !0,
    children: /* @__PURE__ */ (0, y.jsxs)(Fe.Options, {
      labelledBy: _,
      "aria-label": A,
      children: [h ? /* @__PURE__ */ (0, y.jsx)(Lo.Autosize, {
        mah: (m ?? O.floatingHeight) === "viewport" ? "var(--combobox-floating-options-max-height)" : d ?? 220,
        type: "scroll",
        scrollbarSize: "var(--combobox-padding)",
        offsetScrollbars: "y",
        ...M,
        children: $
      }) : $, j && E && /* @__PURE__ */ (0, y.jsx)(Fe.Empty, { children: E })]
    })
  });
}
var tx = {
  root: "m_347db0ec",
  "root--dot": "m_fbd81e3d",
  label: "m_5add502a",
  section: "m_91fdda9b"
}, nx = (n, { radius: o, color: r, gradient: i, variant: c, size: f, autoContrast: d, circle: m }) => {
  const h = n.variantColorResolver({
    color: r || n.primaryColor,
    theme: n,
    gradient: i,
    variant: c || "filled",
    autoContrast: d
  });
  return { root: {
    "--badge-height": $e(f, "badge-height"),
    "--badge-padding-x": $e(f, "badge-padding-x"),
    "--badge-fz": $e(f, "badge-fz"),
    "--badge-radius": m || o === void 0 ? void 0 : St(o),
    "--badge-bg": r || c ? h.background : void 0,
    "--badge-color": r || c ? h.color : void 0,
    "--badge-bd": r || c ? h.border : void 0,
    "--badge-dot-color": c === "dot" ? It(r, n) : void 0
  } };
}, Gi = Sn((n) => {
  const o = pe("Badge", null, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, radius: h, color: g, gradient: w, leftSection: b, rightSection: v, children: x, variant: E, fullWidth: C, autoContrast: _, circle: R, mod: M, attributes: A, ...O } = o, D = Me({
    name: "Badge",
    props: o,
    classes: tx,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: A,
    vars: m,
    varsResolver: nx
  });
  return /* @__PURE__ */ (0, y.jsxs)(xe, {
    variant: E,
    mod: [{
      block: C,
      circle: R,
      "with-right-section": !!v,
      "with-left-section": !!b
    }, M],
    ...D("root", { variant: E }),
    ...O,
    children: [
      b && /* @__PURE__ */ (0, y.jsx)("span", {
        ...D("section"),
        "data-position": "left",
        children: b
      }),
      /* @__PURE__ */ (0, y.jsx)("span", {
        ...D("label"),
        children: x
      }),
      v && /* @__PURE__ */ (0, y.jsx)("span", {
        ...D("section"),
        "data-position": "right",
        children: v
      })
    ]
  });
});
Gi.classes = tx;
Gi.varsResolver = nx;
Gi.displayName = "@mantine/core/Badge";
var Cr = {
  root: "m_77c9d27d",
  inner: "m_80f1301b",
  label: "m_811560b9",
  section: "m_a74036a",
  loader: "m_a25b86ee",
  group: "m_80d6d844",
  groupSection: "m_70be2a01"
}, mb = { orientation: "horizontal" }, ax = (n, { borderWidth: o }) => ({ group: { "--button-border-width": se(o) } }), yu = Ee((n) => {
  const o = pe("ButtonGroup", mb, n), { className: r, style: i, classNames: c, styles: f, unstyled: d, orientation: m, vars: h, borderWidth: g, mod: w, attributes: b, ...v } = pe("ButtonGroup", mb, n), x = Me({
    name: "ButtonGroup",
    props: o,
    classes: Cr,
    className: r,
    style: i,
    classNames: c,
    styles: f,
    unstyled: d,
    attributes: b,
    vars: h,
    varsResolver: ax,
    rootSelector: "group"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...x("group"),
    mod: [{ orientation: m }, w],
    role: "group",
    ...v
  });
});
yu.classes = Cr;
yu.varsResolver = ax;
yu.displayName = "@mantine/core/ButtonGroup";
var ox = (n, { radius: o, color: r, gradient: i, variant: c, autoContrast: f, size: d }) => {
  const m = n.variantColorResolver({
    color: r || n.primaryColor,
    theme: n,
    gradient: i,
    variant: c || "filled",
    autoContrast: f
  });
  return { groupSection: {
    "--section-height": $e(d, "section-height"),
    "--section-padding-x": $e(d, "section-padding-x"),
    "--section-fz": d?.includes("compact") ? Et(d.replace("compact-", "")) : Et(d),
    "--section-radius": o === void 0 ? void 0 : St(o),
    "--section-bg": r || c ? m.background : void 0,
    "--section-color": m.color,
    "--section-bd": r || c ? m.border : void 0
  } };
}, bu = Ee((n) => {
  const o = pe("ButtonGroupSection", null, n), { className: r, style: i, classNames: c, styles: f, unstyled: d, vars: m, gradient: h, radius: g, autoContrast: w, attributes: b, ...v } = o, x = Me({
    name: "ButtonGroupSection",
    props: o,
    classes: Cr,
    className: r,
    style: i,
    classNames: c,
    styles: f,
    unstyled: d,
    attributes: b,
    vars: m,
    varsResolver: ox,
    rootSelector: "groupSection"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...x("groupSection"),
    ...v
  });
});
bu.classes = Cr;
bu.varsResolver = ox;
bu.displayName = "@mantine/core/ButtonGroupSection";
var DA = {
  in: {
    opacity: 1,
    transform: `translate(-50%, calc(-50% + ${se(1)}))`
  },
  out: {
    opacity: 0,
    transform: "translate(-50%, -200%)"
  },
  common: { transformOrigin: "center" },
  transitionProperty: "transform, opacity"
}, lx = (n, { radius: o, color: r, gradient: i, variant: c, size: f, justify: d, autoContrast: m }) => {
  const h = n.variantColorResolver({
    color: r || n.primaryColor,
    theme: n,
    gradient: i,
    variant: c || "filled",
    autoContrast: m
  });
  return { root: {
    "--button-justify": d,
    "--button-height": $e(f, "button-height"),
    "--button-padding-x": $e(f, "button-padding-x"),
    "--button-fz": f?.includes("compact") ? Et(f.replace("compact-", "")) : Et(f),
    "--button-radius": o === void 0 ? void 0 : St(o),
    "--button-bg": r || c ? h.background : void 0,
    "--button-hover": r || c ? h.hover : void 0,
    "--button-color": h.color,
    "--button-bd": r || c ? h.border : void 0,
    "--button-hover-color": r || c ? h.hoverColor : void 0
  } };
}, ln = Sn((n) => {
  const o = pe("Button", null, n), { style: r, vars: i, className: c, color: f, disabled: d, children: m, leftSection: h, rightSection: g, fullWidth: w, variant: b, radius: v, loading: x, loaderProps: E, gradient: C, classNames: _, styles: R, unstyled: M, "data-disabled": A, autoContrast: O, mod: D, attributes: j, ...$ } = o, H = Me({
    name: "Button",
    props: o,
    classes: Cr,
    className: c,
    style: r,
    classNames: _,
    styles: R,
    unstyled: M,
    attributes: j,
    vars: i,
    varsResolver: lx
  }), X = !!h, J = !!g;
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    ...H("root", { active: !d && !x && !A }),
    unstyled: M,
    variant: b,
    disabled: d || x,
    mod: [{
      disabled: d || A,
      loading: x,
      block: w,
      "with-left-section": X,
      "with-right-section": J
    }, D],
    ...$,
    children: [typeof x == "boolean" && /* @__PURE__ */ (0, y.jsx)($a, {
      mounted: x,
      transition: DA,
      duration: 150,
      children: (W) => /* @__PURE__ */ (0, y.jsx)(xe, {
        component: "span",
        ...H("loader", { style: W }),
        "aria-hidden": !0,
        children: /* @__PURE__ */ (0, y.jsx)(pl, {
          color: "var(--button-color)",
          size: "calc(var(--button-height) / 1.8)",
          ...E
        })
      })
    }), /* @__PURE__ */ (0, y.jsxs)("span", {
      ...H("inner"),
      children: [
        h && /* @__PURE__ */ (0, y.jsx)(xe, {
          component: "span",
          ...H("section"),
          mod: { position: "left" },
          children: h
        }),
        /* @__PURE__ */ (0, y.jsx)(xe, {
          component: "span",
          mod: { loading: x },
          ...H("label"),
          children: m
        }),
        g && /* @__PURE__ */ (0, y.jsx)(xe, {
          component: "span",
          ...H("section"),
          mod: { position: "right" },
          children: g
        })
      ]
    })]
  });
});
ln.classes = Cr;
ln.varsResolver = lx;
ln.displayName = "@mantine/core/Button";
ln.Group = yu;
ln.GroupSection = bu;
function LA(n) {
  const o = n.currentTarget;
  return sa(o).activeElement !== o;
}
var rx = {
  root: "m_de3d2490",
  colorOverlay: "m_862f3d1b",
  shadowOverlay: "m_98ae7f22",
  alphaOverlay: "m_95709ac0",
  childrenOverlay: "m_93e74e3"
}, hb = { withShadow: !0 }, ix = (n, { radius: o, size: r }) => ({ root: {
  "--cs-radius": o === void 0 ? void 0 : St(o),
  "--cs-size": se(r)
} }), ji = Sn((n) => {
  const o = pe("ColorSwatch", hb, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, color: h, radius: g, withShadow: w, children: b, attributes: v, ...x } = pe("ColorSwatch", hb, o), E = Me({
    name: "ColorSwatch",
    props: o,
    classes: rx,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: v,
    vars: m,
    varsResolver: ix
  });
  return /* @__PURE__ */ (0, y.jsxs)(xe, {
    ...E("root", { focusable: !0 }),
    ...x,
    children: [
      /* @__PURE__ */ (0, y.jsx)("span", { ...E("alphaOverlay") }),
      w && /* @__PURE__ */ (0, y.jsx)("span", { ...E("shadowOverlay") }),
      /* @__PURE__ */ (0, y.jsx)("span", { ...E("colorOverlay", { style: { backgroundColor: h } }) }),
      /* @__PURE__ */ (0, y.jsx)("span", {
        ...E("childrenOverlay"),
        children: b
      })
    ]
  });
});
ji.classes = rx;
ji.varsResolver = ix;
ji.displayName = "@mantine/core/ColorSwatch";
var BA = [
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "tabSize",
  "textIndent",
  "textRendering",
  "textTransform",
  "width",
  "wordBreak",
  "wordSpacing",
  "scrollbarGutter"
], vb = {
  "min-height": "0",
  "max-height": "none",
  height: "0",
  visibility: "hidden",
  overflow: "hidden",
  position: "absolute",
  "z-index": "-1000",
  top: "0",
  right: "0",
  display: "block"
};
function pb(n) {
  Object.keys(vb).forEach((o) => {
    n.style.setProperty(o, vb[o], "important");
  });
}
function HA(n) {
  const o = window.getComputedStyle(n);
  if (o === null) return null;
  const r = {};
  for (const i of BA) r[i] = o[i];
  return r.boxSizing === "" ? null : {
    sizingStyle: r,
    paddingSize: parseFloat(r.paddingBottom) + parseFloat(r.paddingTop),
    borderSize: parseFloat(r.borderBottomWidth) + parseFloat(r.borderTopWidth)
  };
}
var Mt = null;
function kA(n, o, r = 1, i = 1 / 0) {
  Mt || (Mt = document.createElement("textarea"), Mt.setAttribute("tabindex", "-1"), Mt.setAttribute("aria-hidden", "true"), Mt.setAttribute("aria-label", "autosize measurement"), pb(Mt)), Mt.parentNode === null && document.body.appendChild(Mt);
  const { paddingSize: c, borderSize: f, sizingStyle: d } = n, { boxSizing: m } = d;
  Object.keys(d).forEach((v) => {
    Mt.style[v] = d[v];
  }), pb(Mt), Mt.value = o;
  let h = m === "border-box" ? Mt.scrollHeight + f : Mt.scrollHeight - c;
  Mt.value = o, h = m === "border-box" ? Mt.scrollHeight + f : Mt.scrollHeight - c, Mt.value = "x";
  const g = Mt.scrollHeight - c;
  let w = g * r;
  m === "border-box" && (w = w + c + f), h = Math.max(w, h);
  let b = g * i;
  return m === "border-box" && (b = b + c + f), h = Math.min(b, h), [h, g];
}
function UA({ maxRows: n, minRows: o, onChange: r, ref: i, ...c }) {
  const f = c.value !== void 0, d = (0, S.useRef)(null), m = st(d, i), h = (0, S.useRef)(0), g = (0, S.useRef)(0), w = () => {
    const x = d.current;
    if (!x) return;
    const E = HA(x);
    if (!E) return;
    const [C] = kA(E, x.value || x.placeholder || "x", o, n);
    h.current !== C && (h.current = C, x.style.setProperty("height", `${C}px`, "important"));
  }, b = (0, S.useEffectEvent)(w), v = (x) => {
    f || w(), r?.(x);
  };
  return (0, S.useLayoutEffect)(w), (0, S.useEffect)(() => {
    const x = () => w();
    return window.addEventListener("resize", x), () => window.removeEventListener("resize", x);
  }, []), (0, S.useEffect)(() => {
    const x = d.current;
    if (!x || typeof ResizeObserver > "u") return;
    g.current = x.offsetWidth;
    let E = 0;
    const C = new ResizeObserver(() => {
      d.current && d.current.offsetWidth !== g.current && (g.current = d.current.offsetWidth, cancelAnimationFrame(E), E = requestAnimationFrame(b));
    });
    return C.observe(x), () => {
      cancelAnimationFrame(E), C.disconnect();
    };
  }, []), (0, S.useEffect)(() => {
    const x = () => w();
    return document.fonts.addEventListener("loadingdone", x), () => document.fonts.removeEventListener("loadingdone", x);
  }, []), (0, S.useEffect)(() => {
    const x = (E) => {
      if (d.current?.form === E.target && !f) {
        const C = d.current.value;
        requestAnimationFrame(() => {
          d.current && C !== d.current.value && w();
        });
      }
    };
    return document.body.addEventListener("reset", x), () => document.body.removeEventListener("reset", x);
  }, [f]), /* @__PURE__ */ (0, y.jsx)("textarea", {
    rows: o,
    ...c,
    onChange: v,
    ref: m
  });
}
var Gh = Ee((n) => {
  const { autosize: o, maxRows: r, minRows: i, __staticSelector: c, resize: f, bottomSection: d, bottomSectionProps: m, ...h } = pe([
    "Input",
    "InputWrapper",
    "Textarea"
  ], null, n), g = o && Bb() !== "test", w = g ? {
    maxRows: r,
    minRows: i
  } : {};
  return /* @__PURE__ */ (0, y.jsx)(Za, {
    component: g ? UA : "textarea",
    ...h,
    __staticSelector: c || "Textarea",
    __bottomSection: d,
    __bottomSectionProps: m,
    multiline: !0,
    "data-no-overflow": o && r === void 0 || void 0,
    __vars: { "--input-resize": f },
    ...w
  });
});
Gh.classes = Za.classes;
Gh.displayName = "@mantine/core/Textarea";
var [$A, sn] = Do("Menu component was not found in the tree"), sx = (0, S.createContext)(null);
function cx(n) {
  const { value: o, defaultValue: r, onChange: i, children: c } = pe("MenuCheckboxGroup", null, n), [f, d] = Kt({
    value: o,
    defaultValue: r,
    finalValue: [],
    onChange: i
  }), m = (0, S.useCallback)((h) => {
    d(f.includes(h) ? f.filter((g) => g !== h) : [...f, h]);
  }, [f, d]);
  return /* @__PURE__ */ (0, y.jsx)(sx, {
    value: {
      values: f,
      onChange: m
    },
    children: c
  });
}
cx.displayName = "@mantine/core/MenuCheckboxGroup";
var gr = (0, S.createContext)(null);
function ux({ role: n, checked: o, indicator: r, onSelect: i, color: c, closeMenuOnClick: f, rightSection: d, children: m, disabled: h, dataDisabled: g, className: w, style: b, styles: v, classNames: x, buttonRef: E, others: C }) {
  const _ = sn(), R = (0, S.use)(gr), M = Bn(), { dir: A } = Pa(), O = (0, S.useRef)(null), D = it(C.onClick, () => {
    g || (i(), f && _.closeDropdownImmediately());
  }), j = it(C.onMouseMove, () => {
    if (!_.hasSearch) return;
    const W = O.current?.closest("[data-menu-dropdown]");
    W && W.querySelectorAll("[data-menu-active]").forEach((ie) => {
      ie !== O.current && ie.closest("[data-menu-dropdown]") === W && ie.removeAttribute("data-menu-active");
    });
  }), $ = it(C.onKeyDown, (W) => {
    W.key === "ArrowLeft" && R && (R.close(), R.focusParentItem());
  }), H = c ? M.variantColorResolver({
    color: c,
    theme: M,
    variant: "light"
  }) : void 0, X = c ? pa({
    color: c,
    theme: M
  }) : null, J = _.alignItemsLabels !== "none" || o;
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    onMouseDown: (W) => W.preventDefault(),
    ...C,
    unstyled: _.unstyled,
    tabIndex: _.menuItemTabIndex,
    ..._.getStyles("item", {
      className: w,
      style: b,
      styles: v,
      classNames: x
    }),
    ref: st(O, E),
    role: n,
    "aria-checked": o,
    disabled: h,
    "data-menu-item": !0,
    "data-checked": o || void 0,
    "data-disabled": h || g || void 0,
    "data-mantine-stop-propagation": !0,
    onClick: D,
    onMouseMove: j,
    onKeyDown: Wm({
      siblingSelector: "[data-menu-item]:not([data-disabled])",
      parentSelector: "[data-menu-dropdown]",
      activateOnFocus: !1,
      loop: _.loop,
      dir: A,
      orientation: "vertical",
      onKeyDown: $
    }),
    __vars: {
      "--menu-item-color": X?.isThemeColor && X?.shade === void 0 ? `var(--mantine-color-${X.color}-6)` : H?.color,
      "--menu-item-hover": H?.hover
    },
    children: [
      J && /* @__PURE__ */ (0, y.jsx)("div", {
        ..._.getStyles("itemIndicator", {
          styles: v,
          classNames: x
        }),
        "data-checked": o || void 0,
        children: o ? r : null
      }),
      m && /* @__PURE__ */ (0, y.jsx)("div", {
        ..._.getStyles("itemLabel", {
          styles: v,
          classNames: x
        }),
        "data-menu-item-label": !0,
        children: m
      }),
      d && /* @__PURE__ */ (0, y.jsx)("div", {
        ..._.getStyles("itemSection", {
          styles: v,
          classNames: x
        }),
        "data-position": "right",
        children: d
      })
    ]
  });
}
var Fn = {
  dropdown: "m_dc9b7c9f",
  label: "m_9bfac126",
  divider: "m_efdf90cb",
  item: "m_99ac2aa1",
  search: "m_ef8769b6",
  itemLabel: "m_5476e0d3",
  itemIndicator: "m_8395186e",
  itemSection: "m_8b75e504",
  chevron: "m_b85b0bed"
}, Ph = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, color: d, closeMenuOnClick: m, rightSection: h, children: g, disabled: w, "data-disabled": b, value: v, checked: x, defaultChecked: E, onChange: C, checkIcon: _, ref: R, ...M } = pe("MenuCheckboxItem", null, n), A = sn(), O = (0, S.use)(sx), D = O && v !== void 0 ? O.values.includes(v) : void 0, [j, $] = Kt({
    value: x ?? D,
    defaultValue: E,
    finalValue: !1,
    onChange: C
  }), H = _ ?? A.checkIcon ?? /* @__PURE__ */ (0, y.jsx)(Yh, { size: 10 });
  return /* @__PURE__ */ (0, y.jsx)(ux, {
    role: "menuitemcheckbox",
    checked: j,
    indicator: H,
    onSelect: () => {
      C ? $(!j) : O && v !== void 0 ? O.onChange(v) : $(!j);
    },
    color: d,
    closeMenuOnClick: m,
    rightSection: h,
    disabled: w,
    dataDisabled: b,
    className: r,
    style: i,
    styles: c,
    classNames: o,
    buttonRef: R,
    others: M,
    children: g
  });
});
Ph.classes = Fn;
Ph.displayName = "@mantine/core/MenuCheckboxItem";
function fx(n) {
  const { children: o, disabled: r, longPressDelay: i } = pe("MenuContextMenu", null, n), c = qa(o);
  if (!c) throw new Error("Menu.ContextMenu component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const f = sn(), d = iu(), m = B1({
    childProps: c.props,
    disabled: r || d.disabled,
    opened: f.opened,
    longPressDelay: i,
    setReference: d.reference,
    open: () => f.openDropdown()
  });
  return (0, S.cloneElement)(c, m);
}
fx.displayName = "@mantine/core/MenuContextMenu";
var Xh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("MenuDivider", null, n), m = sn();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...m.getStyles("divider", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    ...d
  });
});
Xh.classes = Fn;
Xh.displayName = "@mantine/core/MenuDivider";
var VA = 500;
function gb(n) {
  return ((n.querySelector("[data-menu-item-label]") ?? n).textContent ?? "").trim().toLowerCase();
}
function YA(n) {
  return n.length > 1 && n.split("").every((o) => o === n[0]);
}
function dx({ enabled: n, opened: o, getDropdown: r }) {
  const i = (0, S.useRef)({
    buffer: "",
    timeoutId: null
  });
  return (0, S.useEffect)(() => {
    if (o && n) return;
    const c = i.current;
    c.timeoutId !== null && (window.clearTimeout(c.timeoutId), c.timeoutId = null), c.buffer = "";
  }, [o, n]), (0, S.useEffect)(() => () => {
    const { timeoutId: c } = i.current;
    c !== null && window.clearTimeout(c);
  }, []), (c) => {
    if (!n || c.defaultPrevented || c.ctrlKey || c.metaKey || c.altKey || c.key.length !== 1 || c.key === " ") return;
    const f = c.target;
    if (f && (f.tagName === "INPUT" || f.tagName === "TEXTAREA" || f.tagName === "SELECT" || f.isContentEditable)) return;
    const d = r();
    if (!d) return;
    const m = Array.from(d.querySelectorAll("[data-menu-item]:not([data-disabled])")).filter((v) => v.closest("[data-menu-dropdown]") === d);
    if (m.length === 0) return;
    const h = i.current;
    h.buffer = (h.buffer + c.key).toLowerCase(), h.timeoutId !== null && window.clearTimeout(h.timeoutId), h.timeoutId = window.setTimeout(() => {
      h.buffer = "", h.timeoutId = null;
    }, VA);
    const g = document.activeElement, w = g ? m.indexOf(g) : -1;
    let b = null;
    if (h.buffer.length === 1 || YA(h.buffer)) {
      const v = h.buffer[0], x = w + 1;
      for (let E = 0; E < m.length; E += 1) {
        const C = (x + E) % m.length;
        if (gb(m[C]).startsWith(v)) {
          b = m[C];
          break;
        }
      }
    } else for (let v = 0; v < m.length; v += 1) if (gb(m[v]).startsWith(h.buffer)) {
      b = m[v];
      break;
    }
    b && (c.preventDefault(), b.focus());
  };
}
var Ih = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, onMouseEnter: d, onMouseLeave: m, onKeyDown: h, children: g, ref: w, ...b } = pe("MenuDropdown", null, n), v = (0, S.useRef)(null), x = sn(), E = dx({
    enabled: !x.hasSearch,
    opened: x.opened,
    getDropdown: () => v.current
  }), C = it(h, (M) => {
    E(M), !(M.defaultPrevented || x.hasSearch) && (M.key === "ArrowUp" || M.key === "ArrowDown") && (M.preventDefault(), v.current?.querySelectorAll("[data-menu-item]:not(:disabled)")[0]?.focus());
  }), _ = it(d, () => (x.trigger === "hover" || x.trigger === "click-hover") && x.openDropdown()), R = it(m, () => (x.trigger === "hover" || x.trigger === "click-hover") && x.closeDropdown());
  return /* @__PURE__ */ (0, y.jsxs)(ft.Dropdown, {
    ...b,
    onMouseEnter: _,
    onMouseLeave: R,
    role: "menu",
    "aria-orientation": "vertical",
    ref: st(w, v),
    ...x.getStyles("dropdown", {
      className: r,
      style: i,
      styles: c,
      classNames: o,
      withStaticClass: !1
    }),
    tabIndex: -1,
    "data-menu-dropdown": !0,
    onKeyDown: C,
    children: [x.withInitialFocusPlaceholder && !x.hasSearch && /* @__PURE__ */ (0, y.jsx)("div", {
      role: "presentation",
      tabIndex: -1,
      "data-autofocus": !0,
      "data-mantine-stop-propagation": !0,
      style: { outline: 0 }
    }), g]
  });
});
Ih.classes = Fn;
Ih.displayName = "@mantine/core/MenuDropdown";
var Qh = Sn((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, color: d, closeMenuOnClick: m, leftSection: h, rightSection: g, children: w, disabled: b, "data-disabled": v, ref: x, ...E } = pe("MenuItem", null, n), C = sn(), _ = (0, S.use)(gr), R = Bn(), { dir: M } = Pa(), A = (0, S.useRef)(null), O = E, D = it(O.onClick, () => {
    v || (typeof m == "boolean" ? m && C.closeDropdownImmediately() : C.closeOnItemClick && C.closeDropdownImmediately());
  }), j = it(O.onMouseMove, () => {
    if (!C.hasSearch) return;
    const J = A.current?.closest("[data-menu-dropdown]");
    J && J.querySelectorAll("[data-menu-active]").forEach((W) => {
      W !== A.current && W.closest("[data-menu-dropdown]") === J && W.removeAttribute("data-menu-active");
    });
  }), $ = d ? R.variantColorResolver({
    color: d,
    theme: R,
    variant: "light"
  }) : void 0, H = d ? pa({
    color: d,
    theme: R
  }) : null, X = it(O.onKeyDown, (J) => {
    J.key === "ArrowLeft" && _ && (_.close(), _.focusParentItem());
  });
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    onMouseDown: (J) => J.preventDefault(),
    ...E,
    unstyled: C.unstyled,
    tabIndex: C.menuItemTabIndex,
    ...C.getStyles("item", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    ref: st(A, x),
    role: "menuitem",
    disabled: b,
    "data-menu-item": !0,
    "data-disabled": b || v || void 0,
    "data-mantine-stop-propagation": !0,
    onClick: D,
    onMouseMove: j,
    onKeyDown: Wm({
      siblingSelector: "[data-menu-item]:not([data-disabled])",
      parentSelector: "[data-menu-dropdown]",
      activateOnFocus: !1,
      loop: C.loop,
      dir: M,
      orientation: "vertical",
      onKeyDown: X
    }),
    __vars: {
      "--menu-item-color": H?.isThemeColor && H?.shade === void 0 ? `var(--mantine-color-${H.color}-6)` : $?.color,
      "--menu-item-hover": $?.hover
    },
    children: [
      C.alignItemsLabels === "all" && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemIndicator", {
          styles: c,
          classNames: o
        }),
        "data-placeholder": !0
      }),
      h && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemSection", {
          styles: c,
          classNames: o
        }),
        "data-position": "left",
        children: h
      }),
      w && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemLabel", {
          styles: c,
          classNames: o
        }),
        "data-menu-item-label": !0,
        children: w
      }),
      g && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemSection", {
          styles: c,
          classNames: o
        }),
        "data-position": "right",
        children: g
      })
    ]
  });
});
Qh.classes = Fn;
Qh.displayName = "@mantine/core/MenuItem";
var Zh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("MenuLabel", null, n), m = sn();
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...m.getStyles("label", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    ...d
  });
});
Zh.classes = Fn;
Zh.displayName = "@mantine/core/MenuLabel";
var mx = (0, S.createContext)(null);
function hx(n) {
  const { value: o, defaultValue: r, onChange: i, children: c } = pe("MenuRadioGroup", null, n), [f, d] = Kt({
    value: o,
    defaultValue: r,
    finalValue: null,
    onChange: i
  });
  return /* @__PURE__ */ (0, y.jsx)(mx, {
    value: {
      value: f,
      onChange: (m) => d(m)
    },
    children: c
  });
}
hx.displayName = "@mantine/core/MenuRadioGroup";
function qA({ size: n, style: o, ...r }) {
  return /* @__PURE__ */ (0, y.jsx)("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 5 5",
    style: {
      width: se(n),
      height: se(n),
      ...o
    },
    "aria-hidden": !0,
    ...r,
    children: /* @__PURE__ */ (0, y.jsx)("circle", {
      cx: "2.5",
      cy: "2.5",
      r: "2.5",
      fill: "currentColor"
    })
  });
}
var Kh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, color: d, closeMenuOnClick: m, rightSection: h, children: g, disabled: w, "data-disabled": b, value: v, checked: x, onChange: E, checkIcon: C, ref: _, ...R } = pe("MenuRadioItem", null, n), M = sn(), A = (0, S.use)(mx), O = x ?? (A ? A.value === v : !1), D = C ?? M.checkIcon ?? /* @__PURE__ */ (0, y.jsx)(qA, { size: 5 });
  return /* @__PURE__ */ (0, y.jsx)(ux, {
    role: "menuitemradio",
    checked: O,
    indicator: D,
    onSelect: () => {
      O || (E ? E(v) : A && A.onChange(v));
    },
    color: d,
    closeMenuOnClick: m,
    rightSection: h,
    disabled: w,
    dataDisabled: b,
    className: r,
    style: i,
    styles: c,
    classNames: o,
    buttonRef: _,
    others: R,
    children: g
  });
});
Kh.classes = Fn;
Kh.displayName = "@mantine/core/MenuRadioItem";
var GA = "[data-menu-item]:not([data-disabled])", PA = "[data-menu-active]";
function xm(n) {
  return n?.closest("[data-menu-dropdown]");
}
function XA(n) {
  return n ? Array.from(n.querySelectorAll(GA)).filter((o) => o.closest("[data-menu-dropdown]") === n) : [];
}
function Vm(n) {
  n && n.querySelectorAll(PA).forEach((o) => {
    o.closest("[data-menu-dropdown]") === n && o.removeAttribute("data-menu-active");
  });
}
function Mc(n, o) {
  Vm(o), n && (n.setAttribute("data-menu-active", "true"), n.scrollIntoView({ block: "nearest" }));
}
function wm(n) {
  return n.findIndex((o) => o.hasAttribute("data-menu-active"));
}
var IA = { clearSearchOnClose: !0 }, Fh = Ee((n) => {
  const { classNames: o, styles: r, onKeyDown: i, onChange: c, size: f, clearSearchOnClose: d, ref: m, ...h } = pe("MenuSearch", IA, n), g = sn(), w = (0, S.useRef)(null), b = st(m, w), v = (0, S.useRef)(c);
  v.current = c, (0, S.useEffect)(() => g.registerSearch(), [g.registerSearch]), (0, S.useEffect)(() => {
    d ? g.searchExitClearRef.current = () => {
      v.current?.({ currentTarget: { value: "" } });
    } : g.searchExitClearRef.current = null;
  }, [d, g.searchExitClearRef]), (0, S.useEffect)(() => {
    g.opened || Vm(xm(w.current));
  }, [g.opened]);
  const x = it(c, (_) => {
    Vm(xm(_.currentTarget));
  }), E = it(i, (_) => {
    if (_.defaultPrevented) return;
    const R = xm(_.currentTarget), M = XA(R);
    if (_.key === "ArrowDown") {
      if (_.preventDefault(), M.length === 0) return;
      const A = wm(M);
      Mc(M[A >= M.length - 1 ? g.loop ? 0 : A : A + 1] ?? null, R);
    } else if (_.key === "ArrowUp") {
      if (_.preventDefault(), M.length === 0) return;
      const A = wm(M);
      Mc(M[A <= 0 ? A === -1 || g.loop ? M.length - 1 : 0 : A - 1] ?? null, R);
    } else if (_.key === "Home")
      _.preventDefault(), M.length > 0 && Mc(M[0], R);
    else if (_.key === "End")
      _.preventDefault(), M.length > 0 && Mc(M[M.length - 1], R);
    else if (_.key === "Enter") {
      if (_.nativeEvent.isComposing || _.nativeEvent.keyCode === 229) return;
      const A = M[wm(M)];
      A && (_.preventDefault(), A.hasAttribute("data-sub-menu-item") ? (A.focus(), A.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: !0
      }))) : A.click());
    }
  }), C = g.getStyles("search");
  return /* @__PURE__ */ (0, y.jsx)(lt, {
    "data-autofocus": !0,
    "data-mantine-stop-propagation": !0,
    type: "search",
    size: f,
    ...h,
    ref: b,
    classNames: [{ input: C.className }, o],
    styles: [{ input: C.style }, r],
    onKeyDown: E,
    onChange: x,
    __staticSelector: "Menu"
  });
});
Fh.classes = Fn;
Fh.displayName = "@mantine/core/MenuSearch";
var Jh = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, onMouseEnter: d, onMouseLeave: m, onPointerEnter: h, onPointerLeave: g, onKeyDown: w, children: b, ref: v, ...x } = pe("MenuSubDropdown", null, n), E = (0, S.useRef)(null), C = sn(), _ = (0, S.use)(gr), R = dx({
    enabled: !C.hasSearch,
    opened: _?.opened ?? !1,
    getDropdown: () => E.current
  }), M = it(w, (O) => {
    R(O), !O.ctrlKey && !O.metaKey && !O.altKey && O.key.length === 1 && O.key !== " " && O.stopPropagation();
  }), A = _?.getFloatingProps({
    onMouseEnter: d,
    onMouseLeave: m,
    onPointerEnter: h,
    onPointerLeave: g
  });
  return /* @__PURE__ */ (0, y.jsx)(ft.Dropdown, {
    ...x,
    ...A,
    role: "menu",
    "aria-orientation": "vertical",
    ref: st(v, E, _?.setFloating),
    ...C.getStyles("dropdown", {
      className: r,
      style: i,
      styles: c,
      classNames: o,
      withStaticClass: !1
    }),
    tabIndex: -1,
    "data-menu-dropdown": !0,
    onKeyDown: M,
    children: b
  });
});
Jh.classes = Fn;
Jh.displayName = "@mantine/core/MenuSubDropdown";
var Wh = Sn((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, color: d, leftSection: m, rightSection: h, children: g, disabled: w, "data-disabled": b, closeMenuOnClick: v, ref: x, ...E } = pe("MenuSubItem", null, n), C = sn(), _ = (0, S.use)(gr), R = Bn(), { dir: M } = Pa(), A = (0, S.useRef)(null), O = E, D = d ? R.variantColorResolver({
    color: d,
    theme: R,
    variant: "light"
  }) : void 0, j = d ? pa({
    color: d,
    theme: R
  }) : null, $ = it(O.onKeyDown, (W) => {
    W.key === "ArrowRight" && (_?.open(), _?.focusFirstItem()), W.key === "ArrowLeft" && _?.parentContext && (_.parentContext.close(), _.parentContext.focusParentItem());
  }), H = it(O.onClick, () => {
    !b && v && C.closeDropdownImmediately();
  }), X = it(O.onMouseMove, () => {
    if (!C.hasSearch) return;
    const W = A.current?.closest("[data-menu-dropdown]");
    W && W.querySelectorAll("[data-menu-active]").forEach((ie) => {
      ie !== A.current && ie.closest("[data-menu-dropdown]") === W && ie.removeAttribute("data-menu-active");
    });
  }), J = _?.getReferenceProps({
    onMouseEnter: O.onMouseEnter,
    onMouseLeave: O.onMouseLeave,
    onPointerEnter: O.onPointerEnter,
    onPointerLeave: O.onPointerLeave
  });
  return /* @__PURE__ */ (0, y.jsxs)(Ia, {
    onMouseDown: (W) => W.preventDefault(),
    ...E,
    ...J,
    unstyled: C.unstyled,
    tabIndex: C.menuItemTabIndex,
    ...C.getStyles("item", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    ref: st(A, x, _?.setReference),
    role: "menuitem",
    disabled: w,
    "data-menu-item": !0,
    "data-sub-menu-item": !0,
    "data-disabled": w || b || void 0,
    "data-mantine-stop-propagation": !0,
    onClick: H,
    onMouseMove: X,
    onKeyDown: Wm({
      siblingSelector: "[data-menu-item]:not([data-disabled])",
      parentSelector: "[data-menu-dropdown]",
      activateOnFocus: !1,
      loop: C.loop,
      dir: M,
      orientation: "vertical",
      onKeyDown: $
    }),
    __vars: {
      "--menu-item-color": j?.isThemeColor && j?.shade === void 0 ? `var(--mantine-color-${j.color}-6)` : D?.color,
      "--menu-item-hover": D?.hover
    },
    children: [
      C.alignItemsLabels === "all" && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemIndicator", {
          styles: c,
          classNames: o
        }),
        "data-placeholder": !0
      }),
      m && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemSection", {
          styles: c,
          classNames: o
        }),
        "data-position": "left",
        children: m
      }),
      g && /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemLabel", {
          styles: c,
          classNames: o
        }),
        "data-menu-item-label": !0,
        children: g
      }),
      /* @__PURE__ */ (0, y.jsx)("div", {
        ...C.getStyles("itemSection", {
          styles: c,
          classNames: o
        }),
        "data-position": "right",
        children: h || /* @__PURE__ */ (0, y.jsx)(_S, {
          ...C.getStyles("chevron"),
          size: 14
        })
      })
    ]
  });
});
Wh.classes = Fn;
Wh.displayName = "@mantine/core/MenuSubItem";
function vx({ children: n, refProp: o }) {
  if (!Jm(n)) throw new Error("Menu.Sub.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  return sn(), /* @__PURE__ */ (0, y.jsx)(ft.Target, {
    refProp: o,
    popupType: "menu",
    children: n
  });
}
vx.displayName = "@mantine/core/MenuSubTarget";
var QA = {
  offset: 0,
  position: "right-start",
  safeAreaPolygon: !0,
  transitionProps: { duration: 0 },
  openDelay: 0,
  middlewares: { shift: { crossAxis: !0 } }
};
function Er(n) {
  const { children: o, closeDelay: r, openDelay: i, position: c, safeAreaPolygon: f, opened: d, onChange: m, ...h } = pe("MenuSub", QA, n), g = bn(), [w, b] = Kt({
    value: d,
    finalValue: !1,
    onChange: m
  }), v = (0, S.use)(gr), x = sn(), { dir: E } = Pa(), C = Ah(E, c), _ = v?.registerOpenSub ?? x.registerOpenSub, R = (0, S.useRef)(null), M = (0, S.useCallback)((ie) => {
    const ae = R.current;
    return ae && ae !== ie && ae(), R.current = ie, () => {
      R.current === ie && (R.current = null);
    };
  }, []), A = (0, S.useRef)(b);
  A.current = b;
  const O = (0, S.useCallback)(() => A.current(!0), []), D = (0, S.useCallback)(() => A.current(!1), []);
  (0, S.useEffect)(() => {
    if (w)
      return _(D);
  }, [
    w,
    _,
    D
  ]);
  const { context: j, refs: $ } = lu({
    placement: C,
    open: w,
    onOpenChange: (ie) => {
      ie ? O() : D();
    }
  }), { getReferenceProps: H, getFloatingProps: X } = C1([x1(j, {
    handleClose: f ? T1(typeof f == "object" ? f : void 0) : void 0,
    delay: {
      open: i,
      close: r
    }
  })]), J = () => window.setTimeout(() => {
    document.getElementById(`${g}-dropdown`)?.querySelectorAll("[data-menu-item]:not([data-disabled])")[0]?.focus();
  }, 16), W = () => window.setTimeout(() => {
    document.getElementById(`${g}-target`)?.focus();
  }, 16);
  return /* @__PURE__ */ (0, y.jsx)(gr, {
    value: {
      opened: w,
      close: D,
      open: O,
      focusFirstItem: J,
      focusParentItem: W,
      parentContext: v,
      setReference: $.setReference,
      setFloating: $.setFloating,
      getReferenceProps: H,
      getFloatingProps: X,
      registerOpenSub: M
    },
    children: /* @__PURE__ */ (0, y.jsx)(ft, {
      opened: w,
      onChange: (ie) => ie ? O() : D(),
      withArrow: !1,
      id: g,
      position: c,
      ...h,
      withinPortal: !1,
      children: o
    })
  });
}
Er.extend = (n) => n;
Er.displayName = "@mantine/core/MenuSub";
Er.Target = vx;
Er.Dropdown = Jh;
Er.Item = Wh;
var ZA = { refProp: "ref" };
function px(n) {
  const { children: o, refProp: r, ...i } = pe("MenuTarget", ZA, n), c = qa(o);
  if (!c) throw new Error("Menu.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported");
  const f = sn(), d = c.props, m = it(d.onClick, () => {
    f.trigger === "click" ? f.toggleDropdown() : f.trigger === "click-hover" && (f.setOpenedViaClick(!0), f.opened || f.openDropdown());
  }), h = it(d.onMouseEnter, () => (f.trigger === "hover" || f.trigger === "click-hover") && f.openDropdown()), g = it(d.onMouseLeave, () => {
    (f.trigger === "hover" || f.trigger === "click-hover" && !f.openedViaClick) && f.closeDropdown();
  });
  return /* @__PURE__ */ (0, y.jsx)(ft.Target, {
    refProp: r,
    popupType: "menu",
    ...i,
    children: (0, S.cloneElement)(c, {
      onClick: m,
      onMouseEnter: h,
      onMouseLeave: g,
      "data-expanded": f.opened ? !0 : void 0
    })
  });
}
px.displayName = "@mantine/core/MenuTarget";
var KA = {
  trapFocus: !0,
  closeOnItemClick: !0,
  withInitialFocusPlaceholder: !0,
  clickOutsideEvents: [
    "mousedown",
    "touchstart",
    "keydown"
  ],
  loop: !0,
  trigger: "click",
  openDelay: 0,
  closeDelay: 100,
  menuItemTabIndex: -1,
  alignItemsLabels: "with-indicators"
}, Tt = Ee((n) => {
  const o = pe("Menu", KA, n), { children: r, onOpen: i, onClose: c, opened: f, defaultOpened: d, trapFocus: m, onChange: h, closeOnItemClick: g, loop: w, closeOnEscape: b, trigger: v, openDelay: x, closeDelay: E, classNames: C, styles: _, unstyled: R, variant: M, vars: A, menuItemTabIndex: O, keepMounted: D, withInitialFocusPlaceholder: j, attributes: $, onExitTransitionEnd: H, alignItemsLabels: X, checkIcon: J, ...W } = o, ie = Me({
    name: "Menu",
    classes: Fn,
    props: o,
    classNames: C,
    styles: _,
    unstyled: R,
    attributes: $
  }), [ae, q] = Kt({
    value: f,
    defaultValue: d,
    finalValue: !1,
    onChange: h
  }), [me, B] = (0, S.useState)(!1), G = () => {
    q(!1), B(!1), ae && c?.();
  }, k = () => {
    q(!0), !ae && i?.();
  }, I = () => {
    ae ? G() : k();
  }, { openDropdown: ee, closeDropdown: te } = KR({
    open: k,
    close: G,
    closeDelay: E,
    openDelay: x
  }), ne = (0, S.useRef)(null), ce = (0, S.useCallback)((de) => {
    const Ne = ne.current;
    return Ne && Ne !== de && Ne(), ne.current = de, () => {
      ne.current === de && (ne.current = null);
    };
  }, []), fe = (0, S.useRef)(0), [N, Z] = (0, S.useState)(!1), ue = (0, S.useCallback)(() => (fe.current += 1, fe.current === 1 && Z(!0), () => {
    fe.current -= 1, fe.current === 0 && Z(!1);
  }), []), re = (0, S.useRef)(null), ge = () => {
    re.current?.(), H?.();
  }, he = (de) => uE("[data-menu-item]", "[data-menu-dropdown]", de), { resolvedClassNames: ye, resolvedStyles: ve } = ki({
    classNames: C,
    styles: _,
    props: o
  });
  return /* @__PURE__ */ (0, y.jsx)($A, {
    value: {
      getStyles: ie,
      opened: ae,
      toggleDropdown: I,
      getItemIndex: he,
      openedViaClick: me,
      setOpenedViaClick: B,
      closeOnItemClick: g,
      closeDropdown: v === "click" ? G : te,
      openDropdown: v === "click" ? k : ee,
      closeDropdownImmediately: G,
      loop: w,
      trigger: v,
      unstyled: R,
      menuItemTabIndex: O,
      withInitialFocusPlaceholder: j,
      registerOpenSub: ce,
      hasSearch: N,
      registerSearch: ue,
      searchExitClearRef: re,
      alignItemsLabels: X,
      checkIcon: J
    },
    children: /* @__PURE__ */ (0, y.jsx)(ft, {
      returnFocus: !0,
      ...W,
      opened: ae,
      onChange: I,
      defaultOpened: d,
      trapFocus: D ? !1 : m,
      closeOnEscape: b,
      __staticSelector: "Menu",
      classNames: ye,
      styles: ve,
      unstyled: R,
      variant: M,
      keepMounted: D,
      onExitTransitionEnd: ge,
      children: r
    })
  });
});
Tt.displayName = "@mantine/core/Menu";
Tt.classes = Fn;
Tt.Item = Qh;
Tt.Label = Zh;
Tt.Dropdown = Ih;
Tt.Target = px;
Tt.Divider = Xh;
Tt.Search = Fh;
Tt.Sub = Er;
Tt.CheckboxItem = Ph;
Tt.CheckboxGroup = cx;
Tt.RadioItem = Kh;
Tt.RadioGroup = hx;
Tt.ContextMenu = fx;
var [FA, Tr] = Do("Modal component was not found in tree"), Ka = {
  root: "m_9df02822",
  content: "m_54c44539",
  inner: "m_1f958f16",
  header: "m_d0e2b9cd"
}, Su = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ModalBody", null, n), m = Tr();
  return /* @__PURE__ */ (0, y.jsx)(uS, {
    ...m.getStyles("body", {
      classNames: o,
      style: i,
      styles: c,
      className: r
    }),
    ...d
  });
});
Su.classes = Ka;
Su.displayName = "@mantine/core/ModalBody";
var xu = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ModalCloseButton", null, n), m = Tr();
  return /* @__PURE__ */ (0, y.jsx)(fS, {
    ...m.getStyles("close", {
      classNames: o,
      style: i,
      styles: c,
      className: r
    }),
    ...d
  });
});
xu.classes = Ka;
xu.displayName = "@mantine/core/ModalCloseButton";
var wu = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, children: d, __hidden: m, ...h } = pe("ModalContent", null, n), g = Tr(), w = g.scrollAreaComponent || nA;
  return /* @__PURE__ */ (0, y.jsx)(dS, {
    ...g.getStyles("content", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    innerProps: g.getStyles("inner", {
      className: r,
      style: i,
      styles: c,
      classNames: o
    }),
    "data-full-screen": g.fullScreen || void 0,
    "data-modal-content": !0,
    "data-hidden": m || void 0,
    ...h,
    children: /* @__PURE__ */ (0, y.jsx)(w, {
      style: { maxHeight: g.fullScreen ? "100dvh" : `calc(100dvh - (${se(g.yOffset)} * 2))` },
      children: d
    })
  });
});
wu.classes = Ka;
wu.displayName = "@mantine/core/ModalContent";
var Cu = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ModalHeader", null, n), m = Tr();
  return /* @__PURE__ */ (0, y.jsx)(mS, {
    ...m.getStyles("header", {
      classNames: o,
      style: i,
      styles: c,
      className: r
    }),
    ...d
  });
});
Cu.classes = Ka;
Cu.displayName = "@mantine/core/ModalHeader";
var Eu = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ModalOverlay", null, n), m = Tr();
  return /* @__PURE__ */ (0, y.jsx)(hS, {
    ...m.getStyles("overlay", {
      classNames: o,
      style: i,
      styles: c,
      className: r
    }),
    ...d
  });
});
Eu.classes = Ka;
Eu.displayName = "@mantine/core/ModalOverlay";
var JA = {
  __staticSelector: "Modal",
  closeOnClickOutside: !0,
  withinPortal: !0,
  lockScroll: !0,
  trapFocus: !0,
  returnFocus: !0,
  closeOnEscape: !0,
  keepMounted: !1,
  zIndex: Ya("modal"),
  transitionProps: {
    duration: 200,
    transition: "fade-down"
  },
  yOffset: "5dvh"
}, gx = (n, { radius: o, size: r, yOffset: i, xOffset: c }) => ({ root: {
  "--modal-radius": o === void 0 ? void 0 : St(o),
  "--modal-size": $e(r, "modal-size"),
  "--modal-y-offset": se(i),
  "--modal-x-offset": se(c)
} }), Pi = Ee((n) => {
  const o = pe("ModalRoot", JA, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, yOffset: h, scrollAreaComponent: g, radius: w, fullScreen: b, centered: v, xOffset: x, __staticSelector: E, attributes: C, ..._ } = o, R = Me({
    name: E,
    classes: Ka,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: C,
    vars: m,
    varsResolver: gx
  });
  return /* @__PURE__ */ (0, y.jsx)(FA, {
    value: {
      yOffset: h,
      scrollAreaComponent: g,
      getStyles: R,
      fullScreen: b
    },
    children: /* @__PURE__ */ (0, y.jsx)(cS, {
      ...R("root"),
      "data-full-screen": b || void 0,
      "data-centered": v || void 0,
      "data-offset-scrollbars": g === Lo.Autosize || void 0,
      unstyled: d,
      ..._
    })
  });
});
Pi.classes = Ka;
Pi.varsResolver = gx;
Pi.displayName = "@mantine/core/ModalRoot";
var yx = (0, S.createContext)(null);
function bx({ children: n }) {
  const [o, r] = (0, S.useState)([]), [i, c] = (0, S.useState)(Ya("modal")), [f] = (0, S.useState)(() => /* @__PURE__ */ new WeakSet());
  return /* @__PURE__ */ (0, y.jsx)(yx, {
    value: {
      stack: o,
      addModal: (d, m) => {
        r((h) => [.../* @__PURE__ */ new Set([...h, d])]), c((h) => typeof m == "number" && typeof h == "number" ? Math.max(h, m) : h);
      },
      removeModal: (d) => r((m) => m.filter((h) => h !== d)),
      getZIndex: (d) => `calc(${i} + ${o.indexOf(d)} + 1)`,
      currentId: o[o.length - 1],
      maxZIndex: i,
      handledEscapeEvents: f
    },
    children: n
  });
}
bx.displayName = "@mantine/core/ModalStack";
var Tu = Ee((n) => {
  const { classNames: o, className: r, style: i, styles: c, vars: f, ...d } = pe("ModalTitle", null, n), m = Tr();
  return /* @__PURE__ */ (0, y.jsx)(vS, {
    ...m.getStyles("title", {
      classNames: o,
      style: i,
      styles: c,
      className: r
    }),
    ...d
  });
});
Tu.classes = Ka;
Tu.displayName = "@mantine/core/ModalTitle";
var WA = {
  closeOnClickOutside: !0,
  withinPortal: !0,
  lockScroll: !0,
  trapFocus: !0,
  returnFocus: !0,
  closeOnEscape: !0,
  keepMounted: !1,
  zIndex: Ya("modal"),
  transitionProps: {
    duration: 200,
    transition: "fade-down"
  },
  withOverlay: !0,
  withCloseButton: !0
}, kn = Ee((n) => {
  const { title: o, withOverlay: r, overlayProps: i, withCloseButton: c, closeButtonProps: f, children: d, radius: m, opened: h, stackId: g, zIndex: w, ...b } = pe("Modal", WA, n), v = (0, S.use)(yx), x = !!o || c, E = v && g ? {
    closeOnEscape: v.currentId === g,
    trapFocus: v.currentId === g,
    zIndex: v.getZIndex(g),
    __handledEscapeEvents: v.handledEscapeEvents
  } : {}, C = r === !1 ? !1 : g && v ? v.currentId === g : h;
  return (0, S.useEffect)(() => {
    v && g && (h ? v.addModal(g, w || Ya("modal")) : v.removeModal(g));
  }, [
    h,
    g,
    w
  ]), /* @__PURE__ */ (0, y.jsxs)(Pi, {
    radius: m,
    opened: h,
    zIndex: v && g ? v.getZIndex(g) : w,
    ...b,
    ...E,
    children: [r && /* @__PURE__ */ (0, y.jsx)(Eu, {
      visible: C,
      transitionProps: v && g ? { duration: 0 } : void 0,
      ...i
    }), /* @__PURE__ */ (0, y.jsxs)(wu, {
      radius: m,
      __hidden: v && g && h ? g !== v.currentId : !1,
      children: [x && /* @__PURE__ */ (0, y.jsxs)(Cu, { children: [o && /* @__PURE__ */ (0, y.jsx)(Tu, { children: o }), c && /* @__PURE__ */ (0, y.jsx)(xu, { ...f })] }), /* @__PURE__ */ (0, y.jsx)(Su, { children: d })]
    })]
  });
});
kn.classes = Ka;
kn.displayName = "@mantine/core/Modal";
kn.Root = Pi;
kn.Overlay = Eu;
kn.Content = wu;
kn.Body = Su;
kn.Header = Cu;
kn.Title = Tu;
kn.CloseButton = xu;
kn.Stack = bx;
function eN(n, o) {
  const r = o.trim().toLowerCase();
  if (r === "") return;
  const i = Object.values(n).filter((c) => !c.disabled && c.label.trim().toLowerCase() === r);
  return i.length === 1 ? i[0] : void 0;
}
function tN({ reveal: n }) {
  return /* @__PURE__ */ (0, y.jsx)("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 256 256",
    style: {
      width: "var(--psi-icon-size)",
      height: "var(--psi-icon-size)"
    },
    children: n ? /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
      /* @__PURE__ */ (0, y.jsx)("path", {
        fill: "none",
        d: "M0 0h256v256H0z"
      }),
      /* @__PURE__ */ (0, y.jsx)("path", {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "16",
        d: "M48 40l160 176M154.91 157.6a40 40 0 01-53.82-59.2M135.53 88.71a40 40 0 0132.3 35.53"
      }),
      /* @__PURE__ */ (0, y.jsx)("path", {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "16",
        d: "M208.61 169.1C230.41 149.58 240 128 240 128s-32-72-112-72a126 126 0 00-20.68 1.68M74 68.6C33.23 89.24 16 128 16 128s32 72 112 72a118.05 118.05 0 0054-12.6"
      })
    ] }) : /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
      /* @__PURE__ */ (0, y.jsx)("path", {
        fill: "none",
        d: "M0 0h256v256H0z"
      }),
      /* @__PURE__ */ (0, y.jsx)("path", {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "16",
        d: "M128 56c-80 0-112 72-112 72s32 72 112 72 112-72 112-72-32-72-112-72z"
      }),
      /* @__PURE__ */ (0, y.jsx)("circle", {
        cx: "128",
        cy: "128",
        r: "40",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "16"
      })
    ] })
  });
}
var Ym = {
  root: "m_f61ca620",
  input: "m_ccf8da4c",
  innerInput: "m_f2d85dd2",
  visibilityToggle: "m_b1072d44"
}, nN = {
  visibilityToggleIcon: tN,
  visibilityToggleFocusable: !1,
  size: "sm"
}, Sx = (n, { size: o }) => ({ root: {
  "--psi-icon-size": $e(o, "psi-icon-size"),
  "--psi-button-size": $e(o, "psi-button-size")
} }), Xi = Ee((n) => {
  const o = pe([
    "Input",
    "InputWrapper",
    "PasswordInput"
  ], nN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, required: h, error: g, success: w, leftSection: b, disabled: v, id: x, variant: E, inputContainer: C, description: _, label: R, size: M, errorProps: A, successProps: O, descriptionProps: D, labelProps: j, withAsterisk: $, inputWrapperOrder: H, wrapperProps: X, radius: J, rightSection: W, rightSectionWidth: ie, rightSectionPointerEvents: ae, leftSectionWidth: q, visible: me, defaultVisible: B, onVisibilityChange: G, visibilityToggleIcon: k, visibilityToggleButtonProps: I, visibilityToggleFocusable: ee, rightSectionProps: te, leftSectionProps: ne, leftSectionPointerEvents: ce, withErrorStyles: fe, withSuccessStyles: N, mod: Z, attributes: ue, dir: re, ...ge } = o, he = bn(x), [ye, ve] = Kt({
    value: me,
    defaultValue: B,
    finalValue: !1,
    onChange: G
  }), de = () => ve(!ye), Ne = Me({
    name: "PasswordInput",
    classes: Ym,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: ue,
    vars: m,
    varsResolver: Sx
  }), { resolvedClassNames: Q, resolvedStyles: Se } = ki({
    classNames: r,
    styles: f,
    props: o
  }), { styleProps: _e, rest: Ae } = yr(ge), Oe = A?.id || `${he}-error`, We = O?.id || `${he}-success`, ct = D?.id || `${he}-description`, tt = !!g && typeof g != "boolean", xt = `${tt ? Oe : ""} ${w && typeof w != "boolean" && !tt ? We : ""} ${_ ? ct : ""}`, Ye = xt.trim().length > 0 ? xt.trim() : void 0, Vt = /* @__PURE__ */ (0, y.jsx)(jo, {
    ...Ne("visibilityToggle"),
    disabled: v,
    radius: J,
    "aria-pressed": ye,
    tabIndex: ee ? 0 : -1,
    "aria-label": "Toggle password visibility",
    ...I,
    variant: I?.variant ?? "subtle",
    color: "gray",
    unstyled: d,
    onTouchEnd: (qe) => {
      qe.preventDefault(), I?.onTouchEnd?.(qe), de();
    },
    onMouseDown: (qe) => {
      qe.preventDefault(), I?.onMouseDown?.(qe), de();
    },
    onKeyDown: (qe) => {
      I?.onKeyDown?.(qe), (qe.key === " " || qe.key === "Enter") && (qe.preventDefault(), de());
    },
    children: /* @__PURE__ */ (0, y.jsx)(k, { reveal: ye })
  });
  return /* @__PURE__ */ (0, y.jsx)(lt.Wrapper, {
    required: h,
    id: he,
    label: R,
    error: g,
    success: w,
    description: _,
    size: M,
    classNames: Q,
    styles: Se,
    __staticSelector: "PasswordInput",
    __stylesApiProps: o,
    unstyled: d,
    withAsterisk: $,
    inputWrapperOrder: H,
    inputContainer: C,
    variant: E,
    labelProps: {
      ...j,
      htmlFor: he
    },
    descriptionProps: {
      ...D,
      id: ct
    },
    errorProps: {
      ...A,
      id: Oe
    },
    successProps: {
      ...O,
      id: We
    },
    mod: Z,
    attributes: ue,
    ...Ne("root"),
    ..._e,
    ...X,
    children: /* @__PURE__ */ (0, y.jsx)(lt, {
      component: "div",
      dir: re,
      error: g,
      success: w,
      leftSection: b,
      size: M,
      classNames: {
        ...Q,
        input: kt(Ym.input, Q?.input)
      },
      styles: Se,
      radius: J,
      disabled: v,
      __staticSelector: "PasswordInput",
      __stylesApiProps: o,
      rightSectionWidth: ie,
      rightSection: W ?? Vt,
      variant: E,
      unstyled: d,
      leftSectionWidth: q,
      rightSectionPointerEvents: ae || "all",
      rightSectionProps: te,
      leftSectionProps: ne,
      leftSectionPointerEvents: ce,
      withAria: !1,
      withErrorStyles: fe,
      withSuccessStyles: N,
      attributes: ue,
      children: /* @__PURE__ */ (0, y.jsx)("input", {
        required: h,
        "data-invalid": !!g || void 0,
        "data-with-left-section": !!b || void 0,
        ...Ne("innerInput"),
        disabled: v,
        id: he,
        dir: re,
        ...Ae,
        "aria-describedby": Ye,
        autoComplete: Ae.autoComplete || "off",
        type: ye ? "text" : "password"
      })
    })
  });
});
Xi.classes = {
  ...Za.classes,
  ...Ym
};
Xi.varsResolver = Sx;
Xi.displayName = "@mantine/core/PasswordInput";
function aN({ offset: n, position: o, defaultOpened: r }) {
  const [i, c] = (0, S.useState)(r), f = (0, S.useRef)(null), { x: d, y: m, elements: h, refs: g, update: w, placement: b } = lu({
    placement: o,
    middleware: [wh({
      crossAxis: !0,
      padding: 5,
      rootBoundary: "document"
    })]
  }), v = b.includes("right") ? n : o.includes("left") ? n * -1 : 0, x = b.includes("bottom") ? n : o.includes("top") ? n * -1 : 0, E = (0, S.useCallback)(({ clientX: C, clientY: _ }) => {
    !Number.isFinite(C) || !Number.isFinite(_) || g.setPositionReference({ getBoundingClientRect() {
      return {
        width: 0,
        height: 0,
        x: C,
        y: _,
        left: C + v,
        top: _ + x,
        right: C,
        bottom: _
      };
    } });
  }, [h.reference]);
  return (0, S.useEffect)(() => {
    if (g.floating.current) {
      const C = f.current;
      C.addEventListener("mousemove", E);
      const _ = Ba(g.floating.current);
      return _.forEach((R) => {
        R.addEventListener("scroll", w);
      }), () => {
        C.removeEventListener("mousemove", E), _.forEach((R) => {
          R.removeEventListener("scroll", w);
        });
      };
    }
  }, [
    h.reference,
    g.floating.current,
    w,
    E,
    i
  ]), {
    handleMouseMove: E,
    x: d,
    y: m,
    opened: i,
    setOpened: c,
    boundaryRef: f,
    floating: g.setFloating
  };
}
var _u = {
  tooltip: "m_1b3c8819",
  arrow: "m_f898399f"
}, oN = {
  refProp: "ref",
  withinPortal: !0,
  offset: 10,
  position: "right",
  zIndex: Ya("popover")
}, xx = (n, { radius: o, color: r }) => ({ tooltip: {
  "--tooltip-radius": o === void 0 ? void 0 : St(o),
  "--tooltip-bg": r ? It(r, n) : void 0,
  "--tooltip-color": r ? "var(--mantine-color-white)" : void 0
} }), Ru = Ee((n) => {
  const o = pe("TooltipFloating", oN, n), { children: r, refProp: i, withinPortal: c, style: f, className: d, classNames: m, styles: h, unstyled: g, radius: w, color: b, label: v, offset: x, position: E, multiline: C, zIndex: _, disabled: R, defaultOpened: M, variant: A, vars: O, portalProps: D, attributes: j, ref: $, ...H } = o, X = Bn(), J = Me({
    name: "TooltipFloating",
    props: o,
    classes: _u,
    className: d,
    style: f,
    classNames: m,
    styles: h,
    unstyled: g,
    attributes: j,
    rootSelector: "tooltip",
    vars: O,
    varsResolver: xx
  }), { handleMouseMove: W, x: ie, y: ae, opened: q, boundaryRef: me, floating: B, setOpened: G } = aN({
    offset: x,
    position: E,
    defaultOpened: M
  }), k = qa(r);
  if (!k) throw new Error("[@mantine/core] Tooltip.Floating component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported");
  const I = st(me, Zc(k), $), ee = k.props, te = (ce) => {
    ee.onMouseEnter?.(ce), W(ce), G(!0);
  }, ne = (ce) => {
    ee.onMouseLeave?.(ce), G(!1);
  };
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsx)(vl, {
    ...D,
    withinPortal: c,
    children: /* @__PURE__ */ (0, y.jsx)(xe, {
      ...H,
      ...J("tooltip", { style: {
        ...Gb(f, X),
        zIndex: _,
        display: !R && q ? "block" : "none",
        top: Number.isFinite(ae) ? Math.round(ae) : "",
        left: Number.isFinite(ie) ? Math.round(ie) : ""
      } }),
      variant: A,
      ref: B,
      mod: { multiline: C },
      children: v
    })
  }), (0, S.cloneElement)(k, {
    ...ee,
    [i]: I,
    onMouseEnter: te,
    onMouseLeave: ne
  })] });
});
Ru.classes = _u;
Ru.varsResolver = xx;
Ru.displayName = "@mantine/core/TooltipFloating";
var wx = (0, S.createContext)({ withinGroup: !1 }), lN = {
  openDelay: 0,
  closeDelay: 0
};
function ev(n) {
  const { openDelay: o, closeDelay: r, children: i } = pe("TooltipGroup", lN, n);
  return /* @__PURE__ */ (0, y.jsx)(wx, {
    value: { withinGroup: !0 },
    children: /* @__PURE__ */ (0, y.jsx)(LR, {
      delay: {
        open: o,
        close: r
      },
      children: i
    })
  });
}
ev.displayName = "@mantine/core/TooltipGroup";
ev.extend = (n) => n;
function rN(n) {
  if (n === void 0) return {
    shift: !0,
    flip: !0
  };
  const o = { ...n };
  return n.shift === void 0 && (o.shift = !0), n.flip === void 0 && (o.flip = !0), o;
}
function iN(n) {
  const o = rN(n.middlewares), r = [g1(n.offset)];
  return o.shift && r.push(wh(typeof o.shift == "boolean" ? { padding: 8 } : {
    padding: 8,
    ...o.shift
  })), o.flip && r.push(typeof o.flip == "boolean" ? km() : km(o.flip)), r.push(y1({
    element: n.arrowRef,
    padding: n.arrowOffset
  })), o.inline ? r.push(typeof o.inline == "boolean" ? Ti() : Ti(o.inline)) : n.inline && r.push(Ti()), r;
}
function sN(n) {
  const [o, r] = (0, S.useState)(n.defaultOpened), i = typeof n.opened == "boolean" ? n.opened : o, c = (0, S.use)(wx).withinGroup, f = bn(), d = (0, S.useCallback)((D) => {
    r(D), D && _(f);
  }, [f]), { x: m, y: h, context: g, refs: w, placement: b, middlewareData: { arrow: { x: v, y: x } = {} } } = lu({
    strategy: n.strategy,
    placement: n.position,
    open: i,
    onOpenChange: d,
    middleware: iN(n),
    whileElementsMounted: Hm
  }), { delay: E, currentId: C, setCurrentId: _ } = BR(g, { id: f }), { getReferenceProps: R, getFloatingProps: M } = C1([
    x1(g, {
      enabled: n.events?.hover,
      delay: c ? E : {
        open: n.openDelay,
        close: n.closeDelay
      },
      mouseOnly: !n.events?.touch,
      handleClose: n.interactive ? T1() : null
    }),
    YR(g, {
      enabled: n.events?.focus,
      visibleOnly: !0
    }),
    GR(g, { role: "tooltip" }),
    $R(g, { enabled: typeof n.opened > "u" })
  ]), A = (0, S.useRef)(b);
  Ua(() => {
    A.current !== b && (A.current = b, n.onPositionChange?.(b));
  }, [b]);
  const O = i && C && C !== f;
  return {
    x: m,
    y: h,
    arrowX: v,
    arrowY: x,
    reference: w.setReference,
    floating: w.setFloating,
    getFloatingProps: M,
    getReferenceProps: R,
    isGroupPhase: O,
    opened: i,
    placement: b
  };
}
var cN = {
  position: "top",
  refProp: "ref",
  withinPortal: !0,
  arrowSize: 4,
  arrowOffset: 5,
  arrowRadius: 0,
  arrowPosition: "side",
  offset: 5,
  transitionProps: {
    duration: 100,
    transition: "fade"
  },
  events: {
    hover: !0,
    focus: !1,
    touch: !1
  },
  zIndex: Ya("popover"),
  middlewares: {
    flip: !0,
    shift: !0,
    inline: !1
  }
}, Cx = (n, { radius: o, color: r, variant: i, autoContrast: c }) => {
  const f = n.variantColorResolver({
    theme: n,
    color: r || n.primaryColor,
    autoContrast: c,
    variant: i || "filled"
  });
  return { tooltip: {
    "--tooltip-radius": o === void 0 ? void 0 : St(o),
    "--tooltip-bg": r ? f.background : void 0,
    "--tooltip-color": r ? f.color : void 0
  } };
}, Oo = Ee((n) => {
  const o = pe("Tooltip", cN, n), { children: r, position: i, refProp: c, label: f, openDelay: d, closeDelay: m, onPositionChange: h, opened: g, defaultOpened: w, withinPortal: b, radius: v, color: x, classNames: E, styles: C, unstyled: _, style: R, className: M, withArrow: A, arrowSize: O, arrowOffset: D, arrowRadius: j, arrowPosition: $, offset: H, transitionProps: X, multiline: J, events: W, interactive: ie, zIndex: ae, disabled: q, onClick: me, onMouseEnter: B, onMouseLeave: G, inline: k, variant: I, keepMounted: ee, vars: te, portalProps: ne, mod: ce, floatingStrategy: fe, middlewares: N, autoContrast: Z, attributes: ue, target: re, ref: ge, ...he } = o, { dir: ye } = Pa(), ve = (0, S.useRef)(null), de = sN({
    position: Ah(ye, i),
    closeDelay: m,
    openDelay: d,
    onPositionChange: h,
    opened: g,
    defaultOpened: w,
    events: W,
    interactive: ie,
    arrowRef: ve,
    arrowOffset: D,
    offset: typeof H == "number" ? H + (A ? O / 2 : 0) : H,
    inline: k,
    strategy: fe,
    middlewares: N
  });
  (0, S.useEffect)(() => {
    const tt = re instanceof HTMLElement ? re : typeof re == "string" ? document.querySelector(re) : re?.current || null;
    tt && de.reference(tt);
  }, [re, de]);
  const Ne = Me({
    name: "Tooltip",
    props: o,
    classes: _u,
    className: M,
    style: R,
    classNames: E,
    styles: C,
    unstyled: _,
    attributes: ue,
    rootSelector: "tooltip",
    vars: te,
    varsResolver: Cx
  }), Q = qa(r);
  if (!re && !Q) throw new Error("[@mantine/core] Tooltip component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported");
  const Se = Ne("tooltip"), _e = ie && !q && !!de.opened, Ae = $ === "merge" && A ? z1({
    position: de.placement,
    dir: ye
  }) : void 0;
  if (re) {
    const tt = rb(X, {
      duration: 100,
      transition: "fade"
    });
    return /* @__PURE__ */ (0, y.jsx)(y.Fragment, { children: /* @__PURE__ */ (0, y.jsx)(vl, {
      ...ne,
      withinPortal: b,
      children: /* @__PURE__ */ (0, y.jsx)($a, {
        ...tt,
        keepMounted: ee,
        mounted: !q && !!de.opened,
        duration: de.isGroupPhase ? 10 : tt.duration,
        children: (xt) => /* @__PURE__ */ (0, y.jsxs)(xe, {
          ...he,
          "data-fixed": fe === "fixed" || void 0,
          variant: I,
          mod: [{
            multiline: J,
            interactive: _e
          }, ce],
          ...Se,
          ...de.getFloatingProps({
            ref: de.floating,
            className: Se.className,
            style: {
              ...Se.style,
              ...xt,
              ...Ae,
              zIndex: ae,
              top: de.y ?? 0,
              left: de.x ?? 0
            }
          }),
          children: [f, /* @__PURE__ */ (0, y.jsx)(Xc, {
            ref: ve,
            arrowX: de.arrowX,
            arrowY: de.arrowY,
            visible: A,
            position: de.placement,
            arrowSize: O,
            arrowOffset: D,
            arrowRadius: j,
            arrowPosition: $,
            ...Ne("arrow")
          })]
        })
      })
    }) });
  }
  const Oe = Q.props, We = st(de.reference, Zc(Q), ge), ct = rb(X, {
    duration: 100,
    transition: "fade"
  });
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsx)(vl, {
    ...ne,
    withinPortal: b,
    children: /* @__PURE__ */ (0, y.jsx)($a, {
      ...ct,
      keepMounted: ee,
      mounted: !q && !!de.opened,
      duration: de.isGroupPhase ? 10 : ct.duration,
      children: (tt) => /* @__PURE__ */ (0, y.jsxs)(xe, {
        ...he,
        "data-fixed": fe === "fixed" || void 0,
        variant: I,
        mod: [{
          multiline: J,
          interactive: _e
        }, ce],
        ...de.getFloatingProps({
          ref: de.floating,
          className: Ne("tooltip").className,
          style: {
            ...Ne("tooltip").style,
            ...tt,
            ...Ae,
            zIndex: ae,
            top: de.y ?? 0,
            left: de.x ?? 0
          }
        }),
        children: [f, /* @__PURE__ */ (0, y.jsx)(Xc, {
          ref: ve,
          arrowX: de.arrowX,
          arrowY: de.arrowY,
          visible: A,
          position: de.placement,
          arrowSize: O,
          arrowOffset: D,
          arrowRadius: j,
          arrowPosition: $,
          ...Ne("arrow")
        })]
      })
    })
  }), (0, S.cloneElement)(Q, de.getReferenceProps({
    onClick: me,
    onMouseEnter: B,
    onMouseLeave: G,
    onMouseMove: o.onMouseMove,
    onPointerDown: o.onPointerDown,
    onPointerEnter: o.onPointerEnter,
    ...Oe,
    className: kt(M, Oe.className),
    [c]: We
  }))] });
});
Oo.classes = _u;
Oo.varsResolver = Cx;
Oo.displayName = "@mantine/core/Tooltip";
Oo.Floating = Ru;
Oo.Group = ev;
var Ex = {
  root: "m_cf365364",
  indicator: "m_9e182ccd",
  label: "m_1738fcb2",
  input: "m_1714d588",
  control: "m_69686b9b",
  innerLabel: "m_78882f40"
}, uN = { withItemsBorders: !0 }, Tx = (n, { radius: o, color: r, transitionDuration: i, size: c, transitionTimingFunction: f }) => ({ root: {
  "--sc-radius": o === void 0 ? void 0 : St(o),
  "--sc-color": r ? It(r, n) : void 0,
  "--sc-shadow": r ? void 0 : "var(--mantine-shadow-xs)",
  "--sc-transition-duration": i === void 0 ? void 0 : `${i}ms`,
  "--sc-transition-timing-function": f,
  "--sc-padding": $e(c, "sc-padding"),
  "--sc-font-size": Et(c)
} }), Ii = Kc((n) => {
  const o = pe("SegmentedControl", uN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, data: h, value: g, defaultValue: w, onChange: b, size: v, name: x, disabled: E, readOnly: C, fullWidth: _, orientation: R, radius: M, color: A, transitionDuration: O, transitionTimingFunction: D, variant: j, autoContrast: $, withItemsBorders: H, mod: X, attributes: J, ref: W, ...ie } = o, ae = Me({
    name: "SegmentedControl",
    props: o,
    classes: Ex,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: J,
    vars: m,
    varsResolver: Tx
  }), q = Bn(), me = h.map((he) => DE(he) ? {
    label: `${he}`,
    value: he
  } : he), B = OE(), [G, k] = (0, S.useState)(Tm()), [I, ee] = (0, S.useState)(null), [te, ne] = (0, S.useState)({}), ce = (he, ye) => {
    he === null || te[ye] === he || (te[ye] = he, ne({ ...te }));
  }, [fe, N] = Kt({
    value: g,
    defaultValue: w,
    finalValue: Array.isArray(h) ? me.find((he) => !he.disabled)?.value ?? h[0]?.value ?? null : null,
    onChange: b
  }), Z = bn(x), ue = me.map((he) => `${he.value}`), re = me.map((he) => /* @__PURE__ */ (0, S.createElement)(xe, {
    ...ae("control"),
    mod: {
      active: fe === he.value,
      orientation: R
    },
    key: `${he.value}`
  }, /* @__PURE__ */ (0, S.createElement)("input", {
    ...ae("input"),
    disabled: E || he.disabled,
    type: "radio",
    name: Z,
    value: `${he.value}`,
    id: `${Z}-${he.value}`,
    checked: fe === he.value,
    onChange: () => !C && N(he.value),
    "data-focus-ring": q.focusRing,
    key: `${he.value}-input`
  }), /* @__PURE__ */ (0, S.createElement)(xe, {
    component: "label",
    ...ae("label"),
    mod: {
      active: fe === he.value && !(E || he.disabled),
      disabled: E || he.disabled,
      "read-only": C
    },
    htmlFor: `${Z}-${he.value}`,
    ref: (ye) => ce(ye, `${he.value}`),
    __vars: { "--sc-label-color": A !== void 0 ? Hi({
      color: A,
      theme: q,
      autoContrast: $
    }) : void 0 },
    key: `${he.value}-label`
  }, /* @__PURE__ */ (0, y.jsx)("span", {
    ...ae("innerLabel"),
    children: he.label
  })))), ge = st(W, ee);
  return _y(() => {
    k(Tm());
  }, [h.length]), _y(() => {
    ne((he) => {
      const ye = {};
      return ue.forEach((ve) => {
        ve in he && (ye[ve] = he[ve]);
      }), Object.keys(ye).length === Object.keys(he).length ? he : ye;
    });
  }, [ue]), h.length === 0 ? null : /* @__PURE__ */ (0, y.jsxs)(xe, {
    ...ae("root"),
    variant: j,
    size: v,
    ref: ge,
    mod: [{
      "full-width": _,
      orientation: R,
      initialized: B,
      "with-items-borders": H
    }, X],
    ...ie,
    role: "radiogroup",
    "data-disabled": E,
    children: [typeof fe < "u" && /* @__PURE__ */ (0, y.jsx)(hu, {
      target: te[`${fe}`],
      parent: I,
      component: "span",
      transitionDuration: "var(--sc-transition-duration)",
      ...ae("indicator")
    }, G), re]
  });
});
Ii.classes = Ex;
Ii.varsResolver = Tx;
Ii.displayName = "@mantine/core/SegmentedControl";
var fN = {
  size: "sm",
  withCheckIcon: !0,
  allowDeselect: !0,
  checkIconPosition: "left",
  openOnFocus: !0
}, tv = Kc((n) => {
  const o = pe([
    "Input",
    "InputWrapper",
    "Select"
  ], fN, n), { classNames: r, styles: i, unstyled: c, vars: f, dropdownOpened: d, defaultDropdownOpened: m, onDropdownClose: h, onDropdownOpen: g, onFocus: w, onBlur: b, onClick: v, onChange: x, data: E, value: C, defaultValue: _, selectFirstOptionOnChange: R, selectFirstOptionOnDropdownOpen: M, onOptionSubmit: A, comboboxProps: O, readOnly: D, disabled: j, filter: $, limit: H, withScrollArea: X, maxDropdownHeight: J, floatingHeight: W, size: ie, searchable: ae, rightSection: q, checkIconPosition: me, withCheckIcon: B, withAlignedLabels: G, nothingFoundMessage: k, name: I, form: ee, searchValue: te, defaultSearchValue: ne, onSearchChange: ce, allowDeselect: fe, error: N, rightSectionPointerEvents: Z, id: ue, clearable: re, clearSectionMode: ge, clearButtonProps: he, hiddenInputProps: ye, renderOption: ve, onClear: de, autoComplete: Ne, scrollAreaProps: Q, __defaultRightSection: Se, __clearSection: _e, __clearable: Ae, chevronColor: Oe, autoSelectOnBlur: We, openOnFocus: ct, attributes: tt, ...xt } = o, Ye = (0, S.useMemo)(() => vA(E), [E]), Vt = (0, S.useRef)({}), qe = (0, S.useMemo)(() => zS(Ye), [Ye]), ga = bn(ue), [Xe, Ft, Cn] = Kt({
    value: C,
    defaultValue: _,
    finalValue: null,
    onChange: x
  }), cn = Xe != null ? `${Xe}` in qe ? qe[`${Xe}`] : Vt.current[`${Xe}`] : void 0, bl = AE(cn), [Sl, Ki, _r] = Kt({
    value: te,
    defaultValue: ne,
    finalValue: cn ? cn.label : "",
    onChange: ce
  }), _t = US({
    opened: d,
    defaultOpened: m,
    onDropdownOpen: () => {
      g?.(), M ? _t.selectFirstOption() : _t.updateSelectedOptionIndex("active", { scrollIntoView: !0 });
    },
    onDropdownClose: () => {
      h?.(), setTimeout(_t.resetSelectedOption, 0);
    }
  }), En = (wt) => {
    Ki(wt), _t.resetSelectedOption();
  }, { resolvedClassNames: Fi, resolvedStyles: Ji } = ki({
    props: o,
    styles: i,
    classNames: r
  });
  (0, S.useEffect)(() => {
    R && _t.selectFirstOption();
  }, [R, Sl]), (0, S.useEffect)(() => {
    C === null && En(""), C != null && cn && (bl?.value !== cn.value || bl?.label !== cn.label) && En(cn.label);
  }, [C, cn]), (0, S.useEffect)(() => {
    !Cn && !_r && En(Xe != null ? `${Xe}` in qe ? qe[`${Xe}`]?.label : Vt.current[`${Xe}`]?.label || "" : "");
  }, [qe, Xe]), (0, S.useEffect)(() => {
    Xe && `${Xe}` in qe && (Vt.current[`${Xe}`] = qe[`${Xe}`]);
  }, [qe, Xe]);
  const Yt = /* @__PURE__ */ (0, y.jsx)(Fe.ClearButton, {
    ...he,
    onClear: () => {
      Ft(null, null), En(""), de?.();
    }
  }), Nu = re && Xe != null && !j && !D;
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsxs)(Fe, {
    store: _t,
    __staticSelector: "Select",
    classNames: Fi,
    styles: Ji,
    unstyled: c,
    readOnly: D,
    size: ie,
    attributes: tt,
    floatingHeight: W,
    keepMounted: We,
    onOptionSubmit: (wt) => {
      A?.(wt);
      const Ut = fe && `${qe[wt].value}` == `${Xe}` ? null : qe[wt], Fa = Ut ? Ut.value : null;
      Fa !== Xe && Ft(Fa, Ut), !Cn && En(Fa != null && Ut?.label || ""), _t.closeDropdown();
    },
    ...O,
    children: [/* @__PURE__ */ (0, y.jsx)(Fe.Target, {
      targetType: ae ? "input" : "button",
      autoComplete: Ne,
      withExpandedAttribute: !0,
      children: /* @__PURE__ */ (0, y.jsx)(Za, {
        id: ga,
        __defaultRightSection: /* @__PURE__ */ (0, y.jsx)(Fe.Chevron, {
          size: ie,
          error: N,
          unstyled: c,
          color: Oe
        }),
        __clearSection: Yt,
        __clearable: Nu,
        __clearSectionMode: ge,
        rightSection: q,
        rightSectionPointerEvents: Z || "none",
        ...xt,
        size: ie,
        __staticSelector: "Select",
        disabled: j,
        readOnly: D || !ae,
        value: Sl,
        onChange: (wt) => {
          if (LA(wt)) {
            if (!D) {
              const Ut = eN(qe, wt.currentTarget.value);
              Ut && `${Ut.value}` != `${Xe}` && (Ft(Ut.value, Ut), !Cn && En(Ut.label));
            }
            return;
          }
          En(wt.currentTarget.value), _t.openDropdown(), R && _t.selectFirstOption();
        },
        onFocus: (wt) => {
          ct && ae && _t.openDropdown(), w?.(wt);
        },
        onBlur: (wt) => {
          We && _t.clickSelectedOption(), ae && _t.closeDropdown();
          const Ut = Xe != null && (`${Xe}` in qe ? qe[`${Xe}`] : Vt.current[`${Xe}`]);
          En(Ut && Ut.label || ""), b?.(wt);
        },
        onClick: (wt) => {
          ae ? _t.openDropdown() : _t.toggleDropdown(), v?.(wt);
        },
        classNames: Fi,
        styles: Ji,
        unstyled: c,
        pointer: !ae,
        error: N,
        attributes: tt
      })
    }), /* @__PURE__ */ (0, y.jsx)(jA, {
      data: Ye,
      hidden: D || j,
      filter: $,
      search: Sl,
      limit: H,
      hiddenWhenEmpty: !k,
      withScrollArea: X,
      maxDropdownHeight: J,
      filterOptions: !!ae && cn?.label !== Sl,
      value: Xe,
      checkIconPosition: me,
      withCheckIcon: B,
      withAlignedLabels: G,
      nothingFoundMessage: k,
      unstyled: c,
      labelId: xt.label ? `${ga}-label` : void 0,
      "aria-label": xt.label ? void 0 : xt["aria-label"],
      renderOption: ve,
      scrollAreaProps: Q
    })]
  }), /* @__PURE__ */ (0, y.jsx)(Fe.HiddenInput, {
    value: Xe,
    name: I,
    form: ee,
    disabled: j,
    ...ye
  })] });
});
tv.classes = {
  ...Za.classes,
  ...Fe.classes
};
tv.displayName = "@mantine/core/Select";
var _x = { root: "m_6d731127" }, dN = {
  gap: "md",
  align: "stretch",
  justify: "flex-start"
}, Rx = (n, { gap: o, align: r, justify: i }) => ({ root: {
  "--stack-gap": vr(o),
  "--stack-align": r,
  "--stack-justify": i
} }), Di = Ee((n) => {
  const o = pe("Stack", dN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, align: h, justify: g, gap: w, variant: b, attributes: v, ...x } = o, E = Me({
    name: "Stack",
    props: o,
    classes: _x,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: v,
    vars: m,
    varsResolver: Rx
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    ...E("root"),
    variant: b,
    ...x
  });
});
Di.classes = _x;
Di.varsResolver = Rx;
Di.displayName = "@mantine/core/Stack";
var Ax = (0, S.createContext)(null), mN = { hiddenInputValuesSeparator: "," }, nv = Kc(((n) => {
  const { value: o, defaultValue: r, onChange: i, size: c, wrapperProps: f, children: d, readOnly: m, name: h, hiddenInputValuesSeparator: g, hiddenInputProps: w, maxSelectedValues: b, disabled: v, ...x } = pe("SwitchGroup", mN, n), [E, C] = Kt({
    value: o,
    defaultValue: r,
    finalValue: [],
    onChange: i
  }), _ = (A) => {
    const O = A.currentTarget.value;
    if (m) return;
    const D = E.includes(O);
    !D && b && E.length >= b || C(D ? E.filter((j) => j !== O) : [...E, O]);
  }, R = (A) => {
    if (v) return !0;
    if (!b) return !1;
    const O = E.includes(A), D = E.length >= b;
    return !O && D;
  }, M = E.join(g);
  return /* @__PURE__ */ (0, y.jsx)(Ax, {
    value: {
      value: E,
      onChange: _,
      size: c,
      isDisabled: R
    },
    children: /* @__PURE__ */ (0, y.jsxs)(lt.Wrapper, {
      size: c,
      ...f,
      ...x,
      labelElement: "div",
      __staticSelector: "SwitchGroup",
      children: [/* @__PURE__ */ (0, y.jsx)(VS, {
        role: "group",
        children: d
      }), /* @__PURE__ */ (0, y.jsx)("input", {
        type: "hidden",
        name: h,
        value: M,
        ...w
      })]
    })
  });
}));
nv.classes = lt.Wrapper.classes;
nv.displayName = "@mantine/core/SwitchGroup";
var Nx = {
  root: "m_5f93f3bb",
  input: "m_926b4011",
  track: "m_9307d992",
  thumb: "m_93039a1d",
  trackLabel: "m_8277e082"
}, hN = {
  labelPosition: "right",
  withThumbIndicator: !0
}, Ox = (n, { radius: o, color: r, size: i }) => ({ root: {
  "--switch-radius": o === void 0 ? void 0 : St(o),
  "--switch-height": $e(i, "switch-height"),
  "--switch-width": $e(i, "switch-width"),
  "--switch-thumb-size": $e(i, "switch-thumb-size"),
  "--switch-label-font-size": $e(i, "switch-label-font-size"),
  "--switch-track-label-padding": $e(i, "switch-track-label-padding"),
  "--switch-color": r ? It(r, n) : void 0
} }), Qi = Ee((n) => {
  const o = pe("Switch", hN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, color: h, label: g, offLabel: w, onLabel: b, id: v, size: x, radius: E, wrapperProps: C, thumbIcon: _, checked: R, defaultChecked: M, onChange: A, labelPosition: O, description: D, error: j, disabled: $, variant: H, rootRef: X, mod: J, withThumbIndicator: W, attributes: ie, ...ae } = o, q = (0, S.use)(Ax), me = x || q?.size, B = Me({
    name: "Switch",
    props: o,
    classes: Nx,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: ie,
    vars: m,
    varsResolver: Ox
  }), { styleProps: G, rest: k } = yr(ae), I = bn(v), ee = [
    D ? `${I}-description` : void 0,
    j && typeof j != "boolean" ? `${I}-error` : void 0,
    k["aria-describedby"]
  ].filter(Boolean).join(" ") || void 0, te = {
    checked: q?.value.includes(k.value) ?? R,
    onChange: (N) => {
      q?.onChange(N), A?.(N);
    }
  }, ne = $ || q?.isDisabled?.(k.value), [ce, fe] = Kt({
    value: te.checked ?? R,
    defaultValue: M,
    finalValue: !1
  });
  return /* @__PURE__ */ (0, y.jsxs)(qh, {
    ...B("root"),
    __staticSelector: "Switch",
    __stylesApiProps: o,
    id: I,
    size: me,
    labelPosition: O,
    label: g,
    description: D,
    error: j,
    disabled: ne,
    bodyElement: "label",
    labelElement: "span",
    classNames: r,
    styles: f,
    unstyled: d,
    "data-checked": te.checked,
    variant: H,
    ref: X,
    mod: J,
    attributes: ie,
    inert: k.inert,
    ...G,
    ...C,
    children: [/* @__PURE__ */ (0, y.jsx)("input", {
      ...k,
      ...te,
      disabled: ne,
      checked: ce,
      "data-checked": te.checked,
      onChange: (N) => {
        te.onChange?.(N), fe(N.currentTarget.checked);
      },
      id: I,
      type: "checkbox",
      role: "switch",
      inert: k.inert,
      "aria-describedby": ee,
      ...B("input")
    }), /* @__PURE__ */ (0, y.jsxs)(xe, {
      "aria-hidden": "true",
      component: "span",
      mod: {
        error: j,
        "label-position": O,
        "without-labels": !b && !w
      },
      ...B("track"),
      children: [/* @__PURE__ */ (0, y.jsx)(xe, {
        component: "span",
        mod: {
          "reduce-motion": !0,
          "with-thumb-indicator": W && !_
        },
        ...B("thumb"),
        children: _
      }), /* @__PURE__ */ (0, y.jsx)("span", {
        ...B("trackLabel"),
        children: ce ? b : w
      })]
    })]
  });
});
Qi.classes = {
  ...Nx,
  ...ZS
};
Qi.varsResolver = Ox;
Qi.displayName = "@mantine/core/Switch";
Qi.Group = nv;
var [vN, pN] = Do("Table component was not found in the tree"), Zi = {
  table: "m_b23fa0ef",
  th: "m_4e7aa4f3",
  tr: "m_4e7aa4fd",
  td: "m_4e7aa4ef",
  tbody: "m_b2404537",
  thead: "m_b242d975",
  caption: "m_9e5a3ac7",
  scrollContainer: "m_a100c15",
  scrollContainerInner: "m_62259741"
};
function gN(n, o) {
  if (!o) return;
  const r = {};
  return o.columnBorder && n.withColumnBorders && (r["data-with-column-border"] = !0), o.rowBorder && n.withRowBorders && (r["data-with-row-border"] = !0), o.striped && n.striped && (r["data-striped"] = n.striped), o.highlightOnHover && n.highlightOnHover && (r["data-hover"] = !0), o.captionSide && n.captionSide && (r["data-side"] = n.captionSide), o.stickyHeader && n.stickyHeader && (r["data-sticky"] = !0), r;
}
function yl(n, o) {
  const r = `Table${n.charAt(0).toUpperCase()}${n.slice(1)}`, i = Ee((c) => {
    const f = pe(r, {}, c), { classNames: d, className: m, style: h, styles: g, ...w } = f, b = pN();
    return /* @__PURE__ */ (0, y.jsx)(xe, {
      component: n,
      ...gN(b, o),
      ...b.getStyles(n, {
        className: m,
        classNames: d,
        style: h,
        styles: g,
        props: f
      }),
      ...w
    });
  });
  return i.displayName = `@mantine/core/${r}`, i.classes = Zi, i;
}
var qm = yl("th", { columnBorder: !0 }), Mx = yl("td", { columnBorder: !0 }), Uc = yl("tr", {
  rowBorder: !0,
  striped: !0,
  highlightOnHover: !0
}), zx = yl("thead", { stickyHeader: !0 }), jx = yl("tbody"), Dx = yl("tfoot"), Lx = yl("caption", { captionSide: !0 }), yN = { type: "scrollarea" }, Bx = (n, { minWidth: o, maxHeight: r, type: i }) => ({ scrollContainer: {
  "--table-min-width": se(o),
  "--table-max-height": se(r),
  "--table-overflow": i === "native" ? "auto" : void 0
} }), Au = Ee((n) => {
  const o = pe("TableScrollContainer", yN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, children: h, minWidth: g, maxHeight: w, type: b, scrollAreaProps: v, attributes: x, ...E } = o, C = Me({
    name: "TableScrollContainer",
    classes: Zi,
    props: o,
    className: i,
    style: c,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: x,
    vars: m,
    varsResolver: Bx,
    rootSelector: "scrollContainer"
  });
  return /* @__PURE__ */ (0, y.jsx)(xe, {
    component: b === "scrollarea" ? Lo : "div",
    ...b === "scrollarea" ? w ? {
      offsetScrollbars: "xy",
      ...v
    } : {
      offsetScrollbars: "x",
      ...v
    } : {},
    ...C("scrollContainer"),
    ...E,
    children: /* @__PURE__ */ (0, y.jsx)("div", {
      ...C("scrollContainerInner"),
      children: h
    })
  });
});
Au.classes = Zi;
Au.varsResolver = Bx;
Au.displayName = "@mantine/core/TableScrollContainer";
function av({ data: n }) {
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
    n.caption && /* @__PURE__ */ (0, y.jsx)(Lx, { children: n.caption }),
    n.head && /* @__PURE__ */ (0, y.jsx)(zx, { children: /* @__PURE__ */ (0, y.jsx)(Uc, { children: n.head.map((o, r) => /* @__PURE__ */ (0, y.jsx)(qm, { children: o }, r)) }) }),
    n.body && /* @__PURE__ */ (0, y.jsx)(jx, { children: n.body.map((o, r) => /* @__PURE__ */ (0, y.jsx)(Uc, { children: o.map((i, c) => /* @__PURE__ */ (0, y.jsx)(Mx, { children: i }, c)) }, r)) }),
    n.foot && /* @__PURE__ */ (0, y.jsx)(Dx, { children: /* @__PURE__ */ (0, y.jsx)(Uc, { children: n.foot.map((o, r) => /* @__PURE__ */ (0, y.jsx)(qm, { children: o }, r)) }) })
  ] });
}
av.displayName = "@mantine/core/TableDataRenderer";
var bN = {
  withRowBorders: !0,
  verticalSpacing: 7
}, Hx = (n, { layout: o, captionSide: r, horizontalSpacing: i, verticalSpacing: c, borderColor: f, stripedColor: d, highlightOnHoverColor: m, striped: h, highlightOnHover: g, stickyHeaderOffset: w, stickyHeader: b }) => ({ table: {
  "--table-layout": o,
  "--table-caption-side": r,
  "--table-horizontal-spacing": vr(i),
  "--table-vertical-spacing": vr(c),
  "--table-border-color": f ? It(f, n) : void 0,
  "--table-striped-color": h && d ? It(d, n) : void 0,
  "--table-highlight-on-hover-color": g && m ? It(m, n) : void 0,
  "--table-sticky-header-offset": b ? se(w) : void 0
} }), bt = Ee((n) => {
  const o = pe("Table", bN, n), { classNames: r, className: i, style: c, styles: f, unstyled: d, vars: m, horizontalSpacing: h, verticalSpacing: g, captionSide: w, stripedColor: b, highlightOnHoverColor: v, striped: x, highlightOnHover: E, withColumnBorders: C, withRowBorders: _, withTableBorder: R, borderColor: M, layout: A, data: O, children: D, stickyHeader: j, stickyHeaderOffset: $, mod: H, tabularNums: X, attributes: J, ...W } = o, ie = Me({
    name: "Table",
    props: o,
    className: i,
    style: c,
    classes: Zi,
    classNames: r,
    styles: f,
    unstyled: d,
    attributes: J,
    rootSelector: "table",
    vars: m,
    varsResolver: Hx
  });
  return /* @__PURE__ */ (0, y.jsx)(vN, {
    value: {
      getStyles: ie,
      stickyHeader: j,
      striped: x === !0 ? "odd" : x || void 0,
      highlightOnHover: E,
      withColumnBorders: C,
      withRowBorders: _,
      captionSide: w || "bottom"
    },
    children: /* @__PURE__ */ (0, y.jsx)(xe, {
      component: "table",
      mod: [{
        withTableBorder: R,
        tabularNums: X
      }, H],
      ...ie("table"),
      ...W,
      children: D || !!O && /* @__PURE__ */ (0, y.jsx)(av, { data: O })
    })
  });
});
bt.classes = Zi;
bt.varsResolver = Hx;
bt.displayName = "@mantine/core/Table";
bt.Td = Mx;
bt.Th = qm;
bt.Tr = Uc;
bt.Thead = zx;
bt.Tbody = jx;
bt.Tfoot = Dx;
bt.Caption = Lx;
bt.ScrollContainer = Au;
bt.DataRenderer = av;
var Pn = Ee((n) => {
  const o = pe([
    "Input",
    "InputWrapper",
    "TextInput"
  ], null, n);
  return /* @__PURE__ */ (0, y.jsx)(Za, {
    component: "input",
    ...o,
    __staticSelector: "TextInput"
  });
});
Pn.classes = Za.classes;
Pn.displayName = "@mantine/core/TextInput";
function SN(n) {
  const o = (0, S.useRef)(null);
  return o.current === null && (o.current = n()), o.current;
}
function xN(n, o) {
  if (n?.inherit && o) {
    const { inherit: r, ...i } = n;
    return {
      ...o,
      ...i
    };
  }
  return n;
}
var yb = (0, S.createContext)({
  transformPagePoint: (n) => n,
  isStatic: !1,
  reducedMotion: "never"
});
function wN({ children: n, ...o }) {
  const r = (0, S.useContext)(yb);
  o = {
    ...r,
    ...o
  }, o.transition = xN(o.transition, r.transition), o.isStatic = SN(() => o.isStatic);
  const i = (0, S.useMemo)(() => o, [
    JSON.stringify(o.transition),
    o.transformPagePoint,
    o.reducedMotion,
    o.skipAnimations,
    o.isValidProp
  ]);
  return (0, y.jsx)(yb.Provider, {
    value: i,
    children: n
  });
}
var CN = tE(), EN = "webcodex.ui.accent.v1", TN = "#2563eb", Li = "webcodex:accent-change", kx = [
  {
    id: "blue",
    label: "Blue",
    color: "#2563eb"
  },
  {
    id: "indigo",
    label: "Indigo",
    color: "#4f46e5"
  },
  {
    id: "teal",
    label: "Teal",
    color: "#0f766e"
  },
  {
    id: "violet",
    label: "Violet",
    color: "#7c3aed"
  },
  {
    id: "orange",
    label: "Orange",
    color: "#c2410c"
  }
];
function Va(n) {
  return typeof n == "string" && /^#[0-9a-f]{6}$/i.test(n) ? n.toLowerCase() : null;
}
function Ux() {
  try {
    return Va(window.localStorage.getItem("webcodex.ui.accent.v1")) || "#2563eb";
  } catch {
    return TN;
  }
}
function _N(n) {
  const o = Va(n);
  if (o) {
    try {
      window.localStorage.setItem(EN, o);
    } catch {
    }
    window.dispatchEvent(new CustomEvent(Li, { detail: o }));
  }
}
function Gm(n) {
  return [
    1,
    3,
    5
  ].map((o) => parseInt(n.slice(o, o + 2), 16));
}
function To(n) {
  return "#" + n.map((o) => Math.round(o).toString(16).padStart(2, "0")).join("");
}
function Ri(n, o, r) {
  return n.map((i, c) => i * (1 - r) + o[c] * r);
}
function bb(n) {
  const [o, r, i] = n.map((c) => {
    const f = c / 255;
    return f <= 0.04045 ? f / 12.92 : ((f + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * o + 0.7152 * r + 0.0722 * i;
}
function Pm(n, o) {
  const r = bb(Gm(n)), i = bb(Gm(o));
  return (Math.max(r, i) + 0.05) / (Math.min(r, i) + 0.05);
}
function Sb(n, o, r, i = 4.5) {
  if (Pm(To(n), o) >= i) return n;
  let c = 0, f = 1;
  for (let d = 0; d < 16; d += 1) {
    const m = (c + f) / 2;
    Pm(To(Ri(n, r, m)), o) >= i ? f = m : c = m;
  }
  return Ri(n, r, f);
}
function ov(n, o) {
  const r = Gm(Va(n) || "#2563eb"), i = o === "dark", c = Sb(r, i ? "#111111" : "#ffffff", i ? [
    255,
    255,
    255
  ] : [
    0,
    0,
    0
  ], 4.6), f = Ri(c, i ? [
    255,
    255,
    255
  ] : [
    0,
    0,
    0
  ], 0.12), d = i ? [
    24,
    24,
    26
  ] : [
    255,
    255,
    255
  ], m = Pm(To(c), "#ffffff") >= 4.5 ? "#ffffff" : "#111111", h = To(Ri(d, c, i ? 0.23 : 0.12)), g = To(Ri(d, c, i ? 0.32 : 0.18)), w = To(Sb(c, g, i ? [
    255,
    255,
    255
  ] : [
    0,
    0,
    0
  ], 4.6));
  return {
    accent: To(c),
    hover: To(f),
    soft: h,
    softHover: g,
    onSoft: w,
    onAccent: m
  };
}
function RN(n, o, r = document.documentElement) {
  const i = ov(n, o);
  r.style.setProperty("--ui-accent", i.accent), r.style.setProperty("--ui-accent-hover", i.hover), r.style.setProperty("--ui-accent-soft", i.soft), r.style.setProperty("--ui-on-accent-soft", i.onSoft), r.style.setProperty("--ui-on-accent", i.onAccent), r.dataset.accent = kx.find((c) => c.color === Va(n))?.id || "custom";
}
function AN(n, o) {
  const r = ov(n, o);
  return (i) => {
    const c = kb(i);
    return (i.color || i.theme.primaryColor) !== "brand" ? c : i.variant === "light" ? {
      ...c,
      background: r.soft,
      hover: r.softHover,
      color: r.onSoft,
      hoverColor: r.onSoft,
      border: "1px solid transparent"
    } : i.variant === "subtle" || i.variant === "outline" ? {
      ...c,
      background: "transparent",
      hover: r.soft,
      color: r.accent,
      hoverColor: r.onSoft,
      border: i.variant === "outline" ? `1px solid ${r.accent}` : "1px solid transparent"
    } : i.variant === "filled" ? {
      ...c,
      background: r.accent,
      hover: r.hover,
      color: r.onAccent,
      hoverColor: r.onAccent
    } : c;
  };
}
var $x = "webcodex.ui.selection.v1", Xm = "webcodex:selection-change";
function Bi(n) {
  return n === "monochrome" ? "monochrome" : "accent";
}
function NN() {
  try {
    return Bi(window.localStorage.getItem($x));
  } catch {
    return "accent";
  }
}
function ON(n) {
  const o = Bi(n);
  try {
    window.localStorage.setItem($x, o);
  } catch {
  }
  window.dispatchEvent(new CustomEvent(Xm, { detail: o }));
}
function MN(n, o = document.documentElement) {
  o.dataset.selectionColor = Bi(n);
}
function Vx() {
  const [n, o] = (0, S.useState)(NN);
  return (0, S.useLayoutEffect)(() => {
    const r = (i) => {
      i instanceof StorageEvent ? (i.key === "webcodex.ui.selection.v1" || i.key === null) && o(Bi(i.newValue)) : o(Bi(i.detail));
    };
    return window.addEventListener("storage", r), window.addEventListener(Xm, r), () => {
      window.removeEventListener("storage", r), window.removeEventListener(Xm, r);
    };
  }, []), (0, S.useLayoutEffect)(() => MN(n), [n]), {
    mode: n,
    setMode: (r) => {
      o(r), ON(r);
    }
  };
}
function xb() {
  return document.documentElement.dataset.resolvedTheme === "dark" ? "dark" : "light";
}
function zN({ children: n }) {
  Vx();
  const [o, r] = (0, S.useState)(xb), [i, c] = (0, S.useState)(Ux);
  (0, S.useEffect)(() => {
    const d = new MutationObserver(() => r(xb()));
    d.observe(document.documentElement, {
      attributes: !0,
      attributeFilter: ["data-resolved-theme"]
    });
    const m = (h) => {
      const g = h instanceof StorageEvent ? h.key === "webcodex.ui.accent.v1" ? Va(h.newValue) : null : Va(h.detail);
      g && c(g);
    };
    return window.addEventListener(Li, m), window.addEventListener("storage", m), () => {
      d.disconnect(), window.removeEventListener(Li, m), window.removeEventListener("storage", m);
    };
  }, []);
  const f = (0, S.useMemo)(() => ({
    primaryColor: "brand",
    primaryShade: {
      light: 6,
      dark: 6
    },
    colors: { brand: GE(ov(i, o).accent) },
    variantColorResolver: AN(i, o),
    fontFamily: "var(--ui-font-family)",
    fontSizes: {
      xs: "12px",
      sm: "13px",
      md: "14px",
      lg: "16px",
      xl: "20px"
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px"
    },
    radius: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px"
    },
    defaultRadius: "md",
    components: {
      Button: ln.extend({
        defaultProps: { size: "sm" },
        classNames: { root: "ui-mantine-button" }
      }),
      TextInput: Pn.extend({
        defaultProps: { size: "sm" },
        classNames: {
          input: "ui-mantine-input",
          label: "ui-mantine-label"
        }
      }),
      PasswordInput: Xi.extend({
        defaultProps: { size: "sm" },
        classNames: {
          input: "ui-mantine-input",
          label: "ui-mantine-label"
        }
      }),
      Select: tv.extend({
        defaultProps: { size: "sm" },
        classNames: {
          input: "ui-mantine-input",
          label: "ui-mantine-label"
        }
      }),
      Textarea: Gh.extend({
        defaultProps: { size: "sm" },
        classNames: {
          input: "ui-mantine-input",
          label: "ui-mantine-label"
        }
      }),
      Modal: kn.extend({ classNames: {
        content: "ui-mantine-modal-content",
        header: "ui-mantine-modal-header",
        title: "ui-mantine-modal-title"
      } }),
      Alert: No.extend({ classNames: { root: "ui-mantine-alert" } }),
      SegmentedControl: Ii.extend({ classNames: {
        root: "ui-mantine-segments",
        indicator: "ui-mantine-segment-indicator"
      } }),
      Menu: Tt.extend({ classNames: { dropdown: "ui-mantine-menu-dropdown" } })
    }
  }), [i, o]);
  return /* @__PURE__ */ (0, y.jsx)(qb, {
    theme: f,
    forceColorScheme: o,
    children: /* @__PURE__ */ (0, y.jsx)(wN, {
      reducedMotion: "user",
      children: n
    })
  });
}
var jN = 260, wb = "http://www.w3.org/2000/svg";
function Yx(n, o) {
  if (n.nodeType === 3) return o.createTextNode(n.textContent ?? "");
  if (n.nodeType !== 1) return null;
  const r = n;
  if (r.hasAttribute("data-selection-motion-skip") || /^(input|select|textarea|script|style|iframe|object)$/i.test(r.localName)) return null;
  const i = r.namespaceURI === wb, c = i ? o.createElementNS(wb, r.localName) : o.createElement("span");
  for (const { name: f, value: d } of Array.from(r.attributes)) (f === "class" || f === "style" || i && !/^(id|tabindex|role|aria-.+|on.+|href|xlink:href)$/i.test(f)) && c.setAttribute(f, d);
  if ((!i || r.localName === "svg") && o.defaultView) {
    const f = o.defaultView.getComputedStyle(r), d = c.style;
    for (const m of [
      "display",
      "box-sizing",
      "font",
      "line-height",
      "letter-spacing",
      "text-transform",
      "text-align",
      "white-space",
      "vertical-align",
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "padding",
      "margin",
      "border-width",
      "border-style",
      "border-radius",
      "align-items",
      "align-self",
      "justify-content",
      "flex-direction",
      "flex-wrap",
      "flex-grow",
      "flex-shrink",
      "flex-basis",
      "gap",
      "order",
      "overflow",
      "overflow-wrap",
      "word-break"
    ]) d.setProperty(m, f.getPropertyValue(m));
    d.borderColor = "transparent";
  }
  for (const f of Array.from(r.childNodes)) {
    const d = Yx(f, o);
    d && c.appendChild(d);
  }
  return c;
}
function wi(n, o) {
  return Math.abs(n.x - o.x) < 0.25 && Math.abs(n.y - o.y) < 0.25 && Math.abs(n.width - o.width) < 0.25 && Math.abs(n.height - o.height) < 0.25;
}
function DN(n, o = {}) {
  const r = n?.ownerDocument, i = r?.defaultView;
  if (!i || !n.querySelectorAll || !n.matches || !i.getComputedStyle) return {
    update() {
    },
    destroy() {
    }
  };
  const c = o.itemSelector ?? '[role="tab"], button', f = o.selectedSelector ?? '[aria-selected="true"], [aria-pressed="true"], .active', d = o.variant ?? "filled", m = n.style.position;
  let h = i.getComputedStyle(n).position === "static";
  h && (n.style.position = "relative");
  const g = r.createElement("span"), w = r.createElement("span"), b = r.createElement("span");
  b.dataset.selectionMotionOrigin = "", g.dataset.selectionMotionPlate = "", w.dataset.selectionMotionForeground = "";
  for (const te of [
    g,
    w,
    b
  ])
    te.dataset.selectionMotionOverlay = "", te.setAttribute("aria-hidden", "true"), te.setAttribute("inert", "");
  n.dataset.selectionMotion = "", n.dataset.selectionMotionVariant = d, n.append(g, w, b);
  let v = [], x = null, E, C = "0px", _ = [], R = !1, M = !1, A = 0, O = 0, D = i.innerWidth;
  const j = i.matchMedia?.("(prefers-reduced-motion: reduce)"), $ = i.matchMedia?.("(forced-colors: active)"), H = new i.MutationObserver((te) => {
    const ne = te.filter((ce) => {
      const fe = ce.target.nodeType === 1 ? ce.target : ce.target.parentElement;
      return fe?.localName === "input" && [
        "name",
        "type",
        "value"
      ].includes(ce.attributeName ?? "") || fe !== n && !fe?.closest(c) ? !1 : !fe?.closest("[data-selection-motion-overlay]") && !(fe === n && ce.attributeName === "data-selection-motion") && ce.attributeName !== "data-selection-motion-item" && ce.attributeName !== "data-selection-motion-selected";
    });
    ne.length && k({ animate: ne.every((ce) => ce.type === "attributes" && [
      "aria-selected",
      "aria-pressed",
      "tabindex",
      "class",
      "data-active",
      "checked",
      "name",
      "value"
    ].includes(ce.attributeName ?? "")) });
  }), X = () => H.observe(n, {
    subtree: !0,
    childList: !0,
    characterData: !0,
    attributes: !0
  }), J = typeof i.ResizeObserver == "function" ? new i.ResizeObserver(() => I()) : null;
  J?.observe(n);
  const W = new i.MutationObserver(() => I());
  function ie(te) {
    const ne = te.getBoundingClientRect(), ce = b.getBoundingClientRect();
    return {
      x: ne.left - ce.left,
      y: ne.top - ce.top,
      width: ne.width,
      height: ne.height
    };
  }
  function ae(te) {
    const ne = ie(te);
    if (d === "filled") return ne;
    const ce = [], fe = r.createTreeWalker(te, 4);
    for (; fe.nextNode(); ) {
      if (!fe.currentNode.textContent?.trim()) continue;
      const ge = r.createRange();
      if (ge.selectNodeContents(fe.currentNode), typeof ge.getBoundingClientRect == "function") {
        const he = ge.getBoundingClientRect();
        he.width > 0 && ce.push(he);
      }
    }
    for (const ge of te.querySelectorAll("svg,img")) {
      const he = ge.getBoundingClientRect();
      he.width > 0 && ce.push(he);
    }
    const N = b.getBoundingClientRect(), Z = i.getComputedStyle(te), ue = ce.length ? Math.min(...ce.map((ge) => ge.left)) - N.left : ne.x + (parseFloat(Z.paddingLeft) || 0), re = ce.length ? Math.max(...ce.map((ge) => ge.right)) - N.left : ne.x + ne.width - (parseFloat(Z.paddingRight) || 0);
    return {
      x: Math.max(ne.x, ue),
      y: ne.y + ne.height - 3,
      width: Math.max(0, Math.min(ne.x + ne.width, re) - Math.max(ne.x, ue)),
      height: 3
    };
  }
  function q(te) {
    return {
      transform: `translate(${te.x}px, ${te.y}px)`,
      width: `${te.width}px`,
      height: `${te.height}px`
    };
  }
  function me(te) {
    return `inset(${te.y}px calc(100% - ${te.x + te.width}px) calc(100% - ${te.y + te.height}px) ${te.x}px round ${C})`;
  }
  function B() {
    for (const te of _) te.cancel();
    _ = [];
  }
  function G(te) {
    for (const ne of v) te.includes(ne) || (ne.removeAttribute("data-selection-motion-item"), ne.removeAttribute("data-selection-motion-selected"), J?.unobserve(ne));
    for (const ne of te) v.includes(ne) || J?.observe(ne);
    v = te, w.replaceChildren();
    for (const ne of v) {
      if (ne.dataset.selectionMotionItem = "", ne.toggleAttribute("data-selection-motion-selected", ne.matches(f)), d === "underline") continue;
      const ce = ie(ne);
      if (ce.width <= 0 || ce.height <= 0) continue;
      const fe = i.getComputedStyle(ne), N = r.createElement("span");
      N.dataset.selectionMotionLabel = "", Object.assign(N.style, {
        left: `${ce.x}px`,
        top: `${ce.y}px`,
        width: `${ce.width}px`,
        height: `${ce.height}px`,
        font: fe.font,
        letterSpacing: fe.letterSpacing,
        textTransform: fe.textTransform,
        lineHeight: fe.lineHeight,
        textAlign: fe.textAlign,
        whiteSpace: fe.whiteSpace,
        justifyContent: /flex|grid/.test(fe.display) ? fe.justifyContent : /left|start/.test(fe.textAlign) ? "flex-start" : /right|end/.test(fe.textAlign) ? "flex-end" : "center",
        alignItems: /flex|grid/.test(fe.display) ? fe.alignItems : "center",
        flexDirection: fe.flexDirection,
        gap: fe.gap,
        padding: fe.padding,
        borderWidth: fe.borderWidth,
        borderStyle: "solid",
        borderColor: "transparent"
      });
      for (const Z of Array.from(ne.childNodes)) {
        const ue = Yx(Z, r);
        ue && N.appendChild(ue);
      }
      w.appendChild(N);
    }
  }
  function k({ animate: te = !0 } = {}) {
    if (R || M) return;
    M = !0, H.disconnect(), h && (n.style.position = m, h = !1), i.getComputedStyle(n).position === "static" && (n.style.position = "relative", h = !0);
    const ne = Array.from(n.querySelectorAll(c)).filter((Z) => !Z.closest("[data-selection-motion-overlay]")), ce = ne.find((Z) => Z.matches(f)), fe = ce ? ae(ce) : null, N = x && !g.hidden ? ie(g) : null;
    if (ce === E && fe && x && wi(fe, x) && te) {
      M = !1, X();
      return;
    }
    if (B(), G(ne), x = fe, E = ce, g.hidden = w.hidden = !fe || fe.width <= 0 || fe.height <= 0, d === "underline" && (w.hidden = !0), fe && ce) {
      Object.assign(g.style, q(fe)), C = d === "underline" ? "999px" : i.getComputedStyle(ce).borderRadius || "0px";
      const Z = ce.lastElementChild;
      if (Z instanceof i.HTMLElement && (!C || /^0(?:px)?$/.test(C)) && wi(ie(Z), fe) && (C = i.getComputedStyle(Z).borderRadius || C), g.style.borderRadius = C, w.style.clipPath = me(fe), te && N && !wi(N, fe) && !j?.matches && !$?.matches && typeof g.animate == "function" && N) {
        const ue = fe.x - N.x, re = fe.y - N.y, ge = Math.hypot(ue, re), he = ge ? 0.03 * Math.abs(ue) / ge : 0, ye = ge ? 0.03 * Math.abs(re) / ge : 0, ve = {
          x: fe.x - fe.width * he / 2,
          y: fe.y - fe.height * ye / 2,
          width: fe.width * (1 + he),
          height: fe.height * (1 + ye)
        }, de = {
          duration: jN,
          easing: "cubic-bezier(.2,.75,.25,1)",
          fill: "none"
        };
        _ = [g.animate([
          q(N),
          {
            ...q(ve),
            offset: 0.72
          },
          q(fe)
        ], de)], d === "filled" && _.push(w.animate([
          { clipPath: me(N) },
          {
            clipPath: me(ve),
            offset: 0.72
          },
          { clipPath: me(fe) }
        ], de));
      }
    }
    M = !1, X(), O || (O = i.requestAnimationFrame(() => {
      if (O = 0, R) return;
      const Z = v.find((ue) => ue.matches(f));
      Z && x && !wi(ae(Z), x) && k({ animate: _.some((ue) => ue.playState === "running" || ue.playState === "paused") });
    }));
  }
  function I() {
    R || A || (A = i.requestAnimationFrame(() => {
      A = 0, k({ animate: !1 });
    }));
  }
  function ee() {
    const te = v.find((ce) => ce.matches(f)), ne = D !== i.innerWidth;
    D = i.innerWidth, (ne || !te || !x || !wi(ae(te), x)) && I();
  }
  return W.observe(r.documentElement, {
    attributes: !0,
    attributeFilter: [
      "class",
      "style",
      "lang",
      "data-mantine-color-scheme",
      "data-theme",
      "data-resolved-theme",
      "data-display-mode",
      "data-selection-color"
    ]
  }), r.body !== n && W.observe(r.body, {
    attributes: !0,
    attributeFilter: [
      "class",
      "style",
      "lang",
      "data-theme"
    ]
  }), j?.addEventListener("change", I), $?.addEventListener("change", I), i.addEventListener("resize", ee), r.fonts?.addEventListener("loadingdone", I), k({ animate: !1 }), {
    update: k,
    destroy() {
      if (!R) {
        R = !0, H.disconnect(), J?.disconnect(), W.disconnect(), B(), i.cancelAnimationFrame(A), i.cancelAnimationFrame(O), j?.removeEventListener("change", I), $?.removeEventListener("change", I), i.removeEventListener("resize", ee), r.fonts?.removeEventListener("loadingdone", I);
        for (const te of v)
          te.removeAttribute("data-selection-motion-item"), te.removeAttribute("data-selection-motion-selected");
        g.remove(), w.remove(), b.remove(), n.removeAttribute("data-selection-motion"), n.removeAttribute("data-selection-motion-variant"), h && (n.style.position = m);
      }
    }
  };
}
function qx(n, o, r = {}) {
  const i = (0, S.useRef)(null), c = (0, S.useRef)(null), f = (0, S.useRef)({});
  (0, S.useLayoutEffect)(() => {
    c.current === n.current && f.current.itemSelector === r.itemSelector && f.current.selectedSelector === r.selectedSelector && f.current.variant === r.variant || (i.current?.destroy(), c.current = n.current, f.current = { ...r }, i.current = n.current ? DN(n.current, r) : null);
  }), (0, S.useLayoutEffect)(() => {
    i.current?.update();
  }, [o]), (0, S.useLayoutEffect)(() => () => {
    i.current?.destroy(), i.current = null, c.current = null;
  }, []);
}
function Im(n) {
  return n ? /^\\\\\?\\UNC\\/i.test(n) ? "\\\\" + n.slice(8) : /^\\\\\?\\[a-z]:\\/i.test(n) ? n.slice(4) : n : "";
}
function LN(n) {
  const o = Im(n.path), r = n.name?.trim(), i = /^[a-z]:[\\/]*$/i.test(o) || /^\\\\[^\\/]+[\\/][^\\/]+[\\/]*$/.test(o);
  return r && !(i && /^project$/i.test(r)) ? r : o.split(/[\\/]/).filter(Boolean).pop() || n.id || "Project";
}
var BN = (n) => n?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
function HN(n, o, r = []) {
  if (o == null) throw new Error("[lucide]: iconNode is required when icon name is used");
  return {
    name: BN(n),
    size: 24,
    node: o,
    ...r.length > 0 ? { aliases: r } : {}
  };
}
var kN = (n) => {
  let o = "", r = !1;
  for (const i of n) {
    if (i === "-" || i === "_" || i <= " ") {
      r = o.length > 0;
      continue;
    }
    o.length === 0 ? o += i.toLowerCase() : o += r ? i.toUpperCase() : i, r = !1;
  }
  return o;
}, UN = (n) => {
  const o = kN(n);
  return o.charAt(0).toUpperCase() + o.slice(1);
}, Qm = (...n) => n.filter((o, r, i) => !!o && o.trim() !== "" && i.indexOf(o) === r).join(" ").trim(), cl = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
function Cm(n) {
  return n != null;
}
function $N(n, o = {}) {
  const r = o.attributeNames ?? {}, i = (b) => r[b] ?? b, c = n.size ?? n.width ?? cl.width, f = n.size ?? n.height ?? cl.height, d = n.aliases?.filter((b) => typeof b == "string" && b.trim() !== "").map((b) => `lucide-${b}`) ?? [], m = [...n.name ? [`lucide-${n.name}`] : [], ...d], h = o.className?.split(" ").filter(Boolean) ?? [], g = o.includeDefaultClasses === !1 ? Qm(...h) : Qm("lucide", ...m, ...h), w = o.absoluteStrokeWidth ? Number(o.strokeWidth ?? cl["stroke-width"]) * Number(n.size ?? n.width ?? cl.width) / Number(o.size ?? o.width ?? cl.width) : o.strokeWidth ?? cl["stroke-width"];
  return [
    "svg",
    {
      ...Object.entries(cl).reduce((b, [v, x]) => (b[i(v)] = x, b), {}),
      ..."color" in o && o.color && { [i("stroke")]: o.color },
      ..."size" in o && Cm(o.size) && {
        [i("width")]: o.size,
        [i("height")]: o.size
      },
      ..."width" in o && Cm(o.width) && { [i("width")]: o.width },
      ..."height" in o && Cm(o.height) && { [i("height")]: o.height },
      [i("stroke-width")]: w,
      ...g && { [i("class")]: g },
      [i("viewBox")]: `0 0 ${c} ${f}`,
      ...o.hasA11yProp === !1 ? { [i("aria-hidden")]: "true" } : {},
      ..."attributes" in o && o.attributes
    },
    n.node.map((b) => {
      const [v, x, E] = b, C = o.nonScalingStroke ? {
        [i("vector-effect")]: "non-scaling-stroke",
        ...x
      } : x;
      return E ? [
        v,
        C,
        E
      ] : [v, C];
    })
  ];
}
function VN(n, o = {}) {
  return $N(n, {
    ...o,
    attributeNames: {
      ...o.attributeNames,
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "vector-effect": "vectorEffect"
    }
  });
}
var YN = (n) => {
  for (const o in n) if (o.startsWith("aria-") || o === "role" || o === "title") return !0;
  return !1;
}, qN = (0, S.createContext)({}), GN = () => (0, S.useContext)(qN), PN = (0, S.forwardRef)(({ color: n, size: o, width: r, height: i, strokeWidth: c, absoluteStrokeWidth: f, nonScalingStroke: d, className: m = "", children: h, iconNode: g = [], icon: w = {
  node: g,
  aliases: [],
  size: 24
}, ...b }, v) => {
  const { size: x = 24, strokeWidth: E = 2, absoluteStrokeWidth: C = !1, nonScalingStroke: _ = !1, color: R = "currentColor", className: M = "" } = GN() ?? {}, A = !!h || YN(b), [O, D, j = []] = VN(w, {
    color: n ?? R,
    width: r ?? o ?? x,
    height: i ?? o ?? x,
    strokeWidth: c ?? E,
    absoluteStrokeWidth: f ?? C,
    nonScalingStroke: d ?? _,
    className: Qm(M, m),
    hasA11yProp: A,
    attributes: b
  });
  return (0, S.createElement)(O, {
    ref: v,
    ...D
  }, [...j.map(([$, H]) => (0, S.createElement)($, H)), ...Array.isArray(h) ? h : [h]]);
});
function wn(n, o = [], r = []) {
  const i = typeof n == "string" ? HN(n, o, r) : n, c = (0, S.forwardRef)(({ className: f, ...d }, m) => (0, S.createElement)(PN, {
    ref: m,
    icon: i,
    className: f,
    ...d
  }));
  return i.name && (c.displayName = UN(i.name)), c;
}
var Gx = {
  name: "activity",
  size: 24,
  node: [["path", {
    d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
    key: "169zse"
  }]]
};
Gx.node;
var XN = wn(Gx), Px = {
  name: "check",
  size: 24,
  node: [["path", {
    d: "M20 6 9 17l-5-5",
    key: "1gmf2c"
  }]]
};
Px.node;
var IN = wn(Px), Xx = {
  name: "ellipsis",
  size: 24,
  node: [
    ["circle", {
      cx: "12",
      cy: "12",
      r: "1",
      key: "41hilf"
    }],
    ["circle", {
      cx: "19",
      cy: "12",
      r: "1",
      key: "1wjl8i"
    }],
    ["circle", {
      cx: "5",
      cy: "12",
      r: "1",
      key: "1pcz8c"
    }]
  ],
  aliases: ["more-horizontal"]
};
Xx.node;
var QN = wn(Xx), Ix = {
  name: "folder",
  size: 24,
  node: [["path", {
    d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
    key: "1kt360"
  }]]
};
Ix.node;
var ZN = wn(Ix), Qx = {
  name: "layout-dashboard",
  size: 24,
  node: [
    ["rect", {
      width: "7",
      height: "9",
      x: "3",
      y: "3",
      rx: "1",
      key: "10lvy0"
    }],
    ["rect", {
      width: "7",
      height: "5",
      x: "14",
      y: "3",
      rx: "1",
      key: "16une8"
    }],
    ["rect", {
      width: "7",
      height: "9",
      x: "14",
      y: "12",
      rx: "1",
      key: "1hutg5"
    }],
    ["rect", {
      width: "7",
      height: "5",
      x: "3",
      y: "16",
      rx: "1",
      key: "ldoo1y"
    }]
  ]
};
Qx.node;
var KN = wn(Qx), Zx = {
  name: "lock-keyhole",
  size: 24,
  node: [
    ["circle", {
      cx: "12",
      cy: "16",
      r: "1",
      key: "1au0dj"
    }],
    ["rect", {
      x: "3",
      y: "10",
      width: "18",
      height: "12",
      rx: "2",
      key: "6s8ecr"
    }],
    ["path", {
      d: "M7 10V7a5 5 0 0 1 10 0v3",
      key: "1pqi11"
    }]
  ]
};
Zx.node;
var FN = wn(Zx), Kx = {
  name: "monitor",
  size: 24,
  node: [
    ["rect", {
      width: "20",
      height: "14",
      x: "2",
      y: "3",
      rx: "2",
      key: "48i651"
    }],
    ["line", {
      x1: "8",
      x2: "16",
      y1: "21",
      y2: "21",
      key: "1svkeh"
    }],
    ["line", {
      x1: "12",
      x2: "12",
      y1: "17",
      y2: "21",
      key: "vw1qmm"
    }]
  ]
};
Kx.node;
var JN = wn(Kx), Fx = {
  name: "moon-star",
  size: 24,
  node: [
    ["path", {
      d: "M18 5h4",
      key: "1lhgn2"
    }],
    ["path", {
      d: "M20 3v4",
      key: "1olli1"
    }],
    ["path", {
      d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
      key: "kfwtm"
    }]
  ]
};
Fx.node;
var WN = wn(Fx), Jx = {
  name: "plus",
  size: 24,
  node: [["path", {
    d: "M5 12h14",
    key: "1ays0h"
  }], ["path", {
    d: "M12 5v14",
    key: "s699le"
  }]]
};
Jx.node;
var e4 = wn(Jx), Wx = {
  name: "refresh-cw",
  size: 24,
  node: [
    ["path", {
      d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
      key: "v9h5vc"
    }],
    ["path", {
      d: "M21 3v5h-5",
      key: "1q7to0"
    }],
    ["path", {
      d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
      key: "3uifl3"
    }],
    ["path", {
      d: "M8 16H3v5",
      key: "1cv678"
    }]
  ]
};
Wx.node;
var t4 = wn(Wx), ew = {
  name: "sun",
  size: 24,
  node: [
    ["circle", {
      cx: "12",
      cy: "12",
      r: "4",
      key: "4exip2"
    }],
    ["path", {
      d: "M12 2v2",
      key: "tus03m"
    }],
    ["path", {
      d: "M12 20v2",
      key: "1lh1kg"
    }],
    ["path", {
      d: "m4.93 4.93 1.41 1.41",
      key: "149t6j"
    }],
    ["path", {
      d: "m17.66 17.66 1.41 1.41",
      key: "ptbguv"
    }],
    ["path", {
      d: "M2 12h2",
      key: "1t8f8n"
    }],
    ["path", {
      d: "M20 12h2",
      key: "1q8mjw"
    }],
    ["path", {
      d: "m6.34 17.66-1.41 1.41",
      key: "1m8zz5"
    }],
    ["path", {
      d: "m19.07 4.93-1.41 1.41",
      key: "1shlcs"
    }]
  ]
};
ew.node;
var n4 = wn(ew), tw = {
  name: "triangle-alert",
  size: 24,
  node: [
    ["path", {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq"
    }],
    ["path", {
      d: "M12 9v4",
      key: "juzpu7"
    }],
    ["path", {
      d: "M12 17h.01",
      key: "p32p05"
    }]
  ],
  aliases: ["alert-triangle"]
};
tw.node;
var a4 = wn(tw), nw = {
  name: "users",
  size: 24,
  node: [
    ["path", {
      d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      key: "1yyitq"
    }],
    ["path", {
      d: "M16 3.128a4 4 0 0 1 0 7.744",
      key: "16gr8j"
    }],
    ["path", {
      d: "M22 21v-2a4 4 0 0 0-3-3.87",
      key: "kshegd"
    }],
    ["circle", {
      cx: "9",
      cy: "7",
      r: "4",
      key: "nufk8"
    }]
  ]
};
nw.node;
var o4 = wn(nw), aw = class extends Error {
  status;
  constructor(n, o) {
    super(o), this.name = "AdminHttpError", this.status = n;
  }
};
function l4(n) {
  return n instanceof DOMException ? n.name === "AbortError" : !!(n && typeof n == "object" && "name" in n && n.name === "AbortError");
}
var r4 = class {
  dependencies;
  generation = 0;
  requestId = 0;
  token = "";
  active = null;
  timer = null;
  constructor(n) {
    this.dependencies = n;
  }
  beginSession(n) {
    return this.invalidateRequests(), this.token = n, this.dependencies.clearError(), this.refresh();
  }
  lock(n = "") {
    this.invalidateRequests(), this.token = "", this.stopAutoRefresh(), this.dependencies.showLocked(n);
  }
  refresh() {
    return this.refreshInternal();
  }
  invalidateAndRefresh() {
    return this.token ? (this.invalidateRequests(), this.refreshInternal()) : Promise.resolve();
  }
  refreshInternal() {
    if (!this.token) return Promise.resolve();
    if (this.active && this.active.generation === this.generation && this.active.token === this.token) return this.active.promise;
    const n = this.generation, o = this.token, r = ++this.requestId, i = new AbortController();
    this.dependencies.clearError();
    const c = this.dependencies.request(o, i.signal).then((f) => {
      this.isCurrent(n, o, r) && (this.dependencies.render(f), this.dependencies.showAuthenticated(), this.dependencies.setStatus(`Updated ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`));
    }).catch((f) => {
      if (!(!this.isCurrent(n, o, r) || l4(f))) {
        if (f instanceof aw && (f.status === 401 || f.status === 403)) {
          this.dependencies.onUnauthorized ? this.dependencies.onUnauthorized() : this.lock("Administrator authentication required.");
          return;
        }
        this.dependencies.showError("Dashboard refresh failed"), this.dependencies.setStatus("Refresh failed; showing last successful data.");
      }
    }).finally(() => {
      this.active?.id === r && (this.active = null);
    });
    return this.active = {
      generation: n,
      id: r,
      token: o,
      controller: i,
      promise: c
    }, c;
  }
  startAutoRefresh(n) {
    if (this.stopAutoRefresh(), !this.token) return;
    const o = this.dependencies.setInterval || setInterval;
    this.timer = o(() => {
      this.refresh();
    }, n);
  }
  stopAutoRefresh() {
    this.timer !== null && ((this.dependencies.clearInterval || clearInterval)(this.timer), this.timer = null);
  }
  dispose() {
    this.invalidateRequests(), this.stopAutoRefresh(), this.token = "";
  }
  invalidateRequests() {
    this.generation += 1, this.active?.controller.abort(), this.active = null;
  }
  isCurrent(n, o, r) {
    return this.generation === n && this.token === o && this.active?.id === r;
  }
}, Ic = class extends Error {
  status;
  code;
  activeJobs;
  constructor(n, o, r) {
    super(o), this.status = n, this.code = o, this.activeJobs = r, this.name = "AdminMutationError";
  }
};
function i4(n) {
  return !!(n && typeof n == "object" && "name" in n && n.name === "AbortError");
}
var s4 = class {
  deps;
  generation = 0;
  token = "";
  contexts = /* @__PURE__ */ new Map();
  constructor(n) {
    this.deps = n;
  }
  beginSession(n) {
    this.invalidate(), this.token = n;
  }
  lock() {
    this.invalidate(), this.token = "";
  }
  dispose() {
    this.invalidate(), this.token = "";
  }
  start(n, o, r) {
    const i = this.contexts.get(o);
    if (!this.token || i) return null;
    const c = {
      kind: n,
      target: o,
      body: { ...r },
      key: this.deps.keyFactory(),
      generation: this.generation,
      token: this.token,
      controller: new AbortController(),
      pending: !1
    };
    return this.contexts.set(o, c), c;
  }
  retry(n) {
    const o = this.contexts.get(n);
    return o ? this.submit(o) : Promise.resolve();
  }
  cancel(n) {
    this.contexts.get(n)?.pending || this.contexts.delete(n);
  }
  has(n) {
    return this.contexts.has(n);
  }
  isPending(n) {
    return this.contexts.get(n)?.pending === !0;
  }
  async submit(n) {
    if (!(!this.current(n) || n.pending)) {
      n.pending = !0, this.deps.pending(n.target, !0);
      try {
        if (await this.deps.request(n.kind, n.token, {
          ...n.body,
          idempotency_key: n.key
        }, n.controller.signal), !this.current(n)) return;
        this.deps.outcome(`${n.kind[0].toUpperCase()}${n.kind.slice(1)} completed.`), this.contexts.delete(n.target), await this.deps.refresh();
      } catch (o) {
        if (!this.current(n) || i4(o)) return;
        const r = o instanceof Ic ? o : new Ic(0, "network_error");
        if (r.code === "unauthorized") {
          this.deps.lock("Administrator authentication required.");
          return;
        }
        this.deps.error(r.code, n), (r.code === "revision_conflict" || r.code === "active_jobs_conflict") && await this.deps.refresh(), r.code === "revision_conflict" && this.contexts.delete(n.target);
      } finally {
        this.generation === n.generation && this.token === n.token && (n.pending = !1, this.deps.pending(n.target, !1));
      }
    }
  }
  current(n) {
    return this.generation === n.generation && this.token === n.token && this.contexts.get(n.target) === n;
  }
  invalidate() {
    this.generation += 1;
    for (const n of this.contexts.values()) n.controller.abort();
    this.contexts.clear();
  }
}, c4 = class {
  mutation;
  adapter;
  target = "";
  context = null;
  bodyFingerprint = "";
  cleaning = !1;
  constructor(n, o) {
    this.mutation = n, this.adapter = o;
  }
  open(n, o = null, r) {
    this.cleanup(!1), this.target = n, this.context = o, this.bodyFingerprint = r ? JSON.stringify(r) : "";
  }
  async submit(n, o) {
    const r = JSON.stringify(o);
    if (this.context && r === this.bodyFingerprint && this.mutation.has(this.target)) {
      await this.mutation.retry(this.target);
      return;
    }
    (this.context || this.mutation.has(this.target)) && this.mutation.cancel(this.target), this.context = this.mutation.start(n, this.target, o), this.bodyFingerprint = r, this.context && await this.mutation.submit(this.context);
  }
  setPendingContext(n, o) {
    this.context = n, this.bodyFingerprint = JSON.stringify(o);
  }
  cancel() {
    this.cleanup(!0);
  }
  handleCancel(n) {
    n.preventDefault(), !(this.target && this.mutation.isPending(this.target)) && this.cleanup(!0);
  }
  handleClose() {
    this.cleanup(!0);
  }
  closeForSessionEnd() {
    this.cleanup(!0);
  }
  currentTarget() {
    return this.target;
  }
  cleanup(n) {
    if (this.cleaning || !this.target && !this.context && !this.bodyFingerprint) return;
    this.cleaning = !0;
    const o = this.target;
    this.target = "", this.context = null, this.bodyFingerprint = "", o && this.mutation.cancel(o), this.adapter.clearSensitive(), n && this.adapter.isOpen() && this.adapter.close(), this.adapter.restoreFocus(), this.cleaning = !1;
  }
};
function u4({ accent: n, appearance: o, onAccentChange: r, onAppearanceCycle: i, translate: c = (f) => f }) {
  const [f, d] = (0, S.useState)(!1), [m, h] = (0, S.useState)(n), g = Vx(), w = (0, S.useRef)(null);
  qx(w, g.mode, {
    itemSelector: ".mantine-SegmentedControl-label",
    selectedSelector: ".mantine-SegmentedControl-label[data-active]"
  }), (0, S.useEffect)(() => h(n), [n]);
  const b = `${c("Appearance")} · ${c(o === "system" ? "System" : o === "light" ? "Light" : "Dark")}`;
  return /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsxs)(ft, {
    opened: f,
    onChange: d,
    width: 244,
    position: "top-start",
    offset: 8,
    withinPortal: !0,
    trapFocus: !0,
    returnFocus: !0,
    zIndex: 1100,
    shadow: "md",
    radius: "md",
    children: [/* @__PURE__ */ (0, y.jsx)(ft.Target, { children: /* @__PURE__ */ (0, y.jsx)(Oo, {
      label: c("Accent color"),
      openDelay: 400,
      disabled: f,
      children: /* @__PURE__ */ (0, y.jsx)(jo, {
        className: "appearance-preference-button",
        variant: "subtle",
        color: "gray",
        size: 36,
        radius: "md",
        "aria-label": c("Accent color"),
        onClick: () => d((v) => !v),
        children: /* @__PURE__ */ (0, y.jsx)(ji, {
          color: n,
          size: 16,
          withShadow: !1,
          "aria-hidden": "true"
        })
      })
    }) }), /* @__PURE__ */ (0, y.jsx)(ft.Dropdown, {
      className: "appearance-preference-popover",
      "aria-label": c("Accent color"),
      children: /* @__PURE__ */ (0, y.jsxs)(Di, {
        gap: "md",
        children: [
          /* @__PURE__ */ (0, y.jsx)(Mi, {
            size: "sm",
            fw: 600,
            children: c("Accent color")
          }),
          /* @__PURE__ */ (0, y.jsx)(fu, {
            gap: "sm",
            justify: "space-between",
            children: kx.map((v) => /* @__PURE__ */ (0, y.jsx)(Oo, {
              label: c(v.label),
              children: /* @__PURE__ */ (0, y.jsx)(ji, {
                component: "button",
                type: "button",
                color: v.color,
                size: 32,
                "aria-label": c(v.label),
                "aria-pressed": n.toLowerCase() === v.color,
                "data-autofocus": n.toLowerCase() === v.color || void 0,
                onClick: () => {
                  r(v.color), d(!1);
                },
                children: n.toLowerCase() === v.color && /* @__PURE__ */ (0, y.jsx)(IN, {
                  size: 17,
                  color: "white",
                  "aria-hidden": "true"
                })
              })
            }, v.id))
          }),
          /* @__PURE__ */ (0, y.jsx)(Pn, {
            size: "xs",
            label: c("Custom color"),
            value: m,
            maxLength: 7,
            placeholder: "#2563eb",
            onChange: (v) => {
              const x = v.currentTarget.value;
              h(x);
              const E = Va(x);
              E && r(E);
            },
            onBlur: () => h(n)
          }),
          /* @__PURE__ */ (0, y.jsxs)(Di, {
            gap: "xs",
            children: [/* @__PURE__ */ (0, y.jsx)(Mi, {
              size: "sm",
              fw: 600,
              children: c("Selected color")
            }), /* @__PURE__ */ (0, y.jsx)(Ii, {
              ref: w,
              value: g.mode,
              onChange: g.setMode,
              "aria-label": c("Selected color"),
              styles: { indicator: { display: "none" } },
              withItemsBorders: !1,
              data: [{
                value: "accent",
                label: c("Theme color")
              }, {
                value: "monochrome",
                label: c("Black and white")
              }]
            })]
          })
        ]
      })
    })]
  }), /* @__PURE__ */ (0, y.jsx)(Oo, {
    label: b,
    openDelay: 400,
    children: /* @__PURE__ */ (0, y.jsx)(jo, {
      className: "appearance-preference-button",
      variant: "subtle",
      color: "gray",
      size: 36,
      radius: "md",
      "aria-label": c("Appearance"),
      "aria-description": b,
      onClick: i,
      children: o === "system" ? /* @__PURE__ */ (0, y.jsx)(JN, { size: 18 }) : o === "dark" ? /* @__PURE__ */ (0, y.jsx)(WN, { size: 18 }) : /* @__PURE__ */ (0, y.jsx)(n4, { size: 18 })
    })
  })] });
}
var f4 = new URL("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%20fill='none'%3e%3crect%20x='2'%20y='2'%20width='60'%20height='60'%20rx='17'%20fill='%23202329'/%3e%3crect%20x='2.75'%20y='2.75'%20width='58.5'%20height='58.5'%20rx='16.25'%20stroke='%23FFFFFF'%20stroke-opacity='.18'%20stroke-width='1.5'/%3e%3cpath%20d='M18%2016.5h27.5a5%205%200%200%201%205%205V38'%20stroke='%23FFFFFF'%20stroke-opacity='.42'%20stroke-width='2.5'%20stroke-linecap='round'/%3e%3crect%20x='12.5'%20y='22.5'%20width='38'%20height='29'%20rx='7'%20fill='%23F7F8FA'/%3e%3cpath%20d='m22.5%2032%206.5%205.5-6.5%205.5'%20stroke='%23202329'%20stroke-width='3.5'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3cpath%20d='M34%2043h8.5'%20stroke='%23202329'%20stroke-width='3.5'%20stroke-linecap='round'/%3e%3c/svg%3e", "" + import.meta.url).href;
function d4() {
  return /* @__PURE__ */ (0, y.jsx)("img", {
    className: "brand-mark",
    src: f4,
    alt: "",
    "aria-hidden": "true"
  });
}
var Cb = {
  overview: {},
  diagnostics: {},
  devices: [],
  projects: [],
  activity: [],
  errors: {
    overview: "",
    devices: "",
    projects: "",
    activity: ""
  }
};
function La(n) {
  return n && typeof n == "object" && !Array.isArray(n) ? n : {};
}
function Em(n) {
  return Array.isArray(n) ? n.map(La) : [];
}
function Pe(n) {
  if (n == null || n === "") return "—";
  if (typeof n == "object") try {
    return JSON.stringify(n);
  } catch {
    return "—";
  }
  return String(n);
}
function m4(n) {
  return Array.isArray(n) ? n.filter((o) => typeof o == "string") : n && typeof n == "object" ? Object.entries(n).filter(([, o]) => o === !0).map(([o]) => o).sort() : [];
}
function h4(n) {
  const o = Pe(n).toLowerCase();
  return /(error|failed|offline|incompatible|mismatch|disabled|blocked|unavailable)/.test(o) ? o.includes("disabled") ? "warning" : "error" : /(warning|unknown|pending|degraded|limited)/.test(o) ? "warning" : /(ok|ready|online|compatible|enabled|healthy|available|true)/.test(o) ? "good" : "info";
}
function v4(n, o) {
  const r = La(o), i = La(r.section_status), c = { ...n.errors }, f = (w) => {
    const b = La(i[w]);
    return c[w] = b.status === "error" ? Pe(b.error || `${w} unavailable`) : "", !!c[w];
  }, d = f("overview"), m = f("devices"), h = f("projects"), g = f("activity");
  return {
    overview: d ? n.overview : La(r.overview),
    diagnostics: d ? n.diagnostics : La(r.diagnostics),
    devices: m ? n.devices : Em(r.devices),
    projects: h ? n.projects : Em(r.projects),
    activity: g ? n.activity : Em(r.activity),
    errors: c
  };
}
var p4 = "/api/admin/", Eb = 1e4, ow = "webcodex.admin.appearance.v1", zc = {
  client_id: "",
  project_id: "",
  name: "",
  description: "",
  path: "",
  allow_patch: !0,
  git_init: !1,
  template: "",
  adopt_existing_empty: !1,
  confirm_project: ""
}, g4 = {
  invalid_request: "The request is invalid. Review the fields and try again.",
  revision_conflict: "Project state changed. The dashboard was refreshed; confirm again using the latest revision.",
  active_jobs_conflict: "The project has active jobs. No jobs were stopped; refresh and retry after they finish.",
  idempotency_conflict: "This retry no longer matches its original operation. Start a new operation.",
  unsupported_runner_version: "The Agent does not support project lifecycle operations.",
  agent_unavailable: "The Agent is unavailable. Current dashboard data is preserved; retry this same operation later.",
  operation_indeterminate: "The Agent may have completed the operation. Refresh state first, then retry this same operation context rather than creating a new mutation.",
  operation_failed: "The operation failed safely. Internal details were not displayed.",
  network_error: "Network failure. Current data is preserved; retry this same operation.",
  unauthorized: "Administrator authentication required."
};
function y4() {
  try {
    const n = localStorage.getItem(ow);
    if (n === "light" || n === "dark") return n;
  } catch {
  }
  return "system";
}
async function lw(n) {
  try {
    return await n.json();
  } catch {
    return null;
  }
}
async function b4(n, o) {
  const r = await fetch("/api/admin/dashboard", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + n,
      "Content-Type": "application/json"
    },
    body: "{}",
    signal: o
  }), i = await lw(r);
  if (!r.ok) throw new aw(r.status, "dashboard_failed");
  return i;
}
async function S4(n, o, r, i) {
  const c = await fetch(`${p4}projects/${n}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + o,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(r),
    signal: i
  }), f = La(await lw(c));
  if (c.ok) return f;
  if (c.status === 401 || c.status === 403) throw new Ic(c.status, "unauthorized");
  const d = La(f.error).code, m = /* @__PURE__ */ new Set([
    "invalid_request",
    "revision_conflict",
    "active_jobs_conflict",
    "idempotency_conflict",
    "unsupported_runner_version",
    "agent_unavailable",
    "operation_indeterminate",
    "operation_failed"
  ]);
  throw new Ic(c.status, typeof d == "string" && m.has(d) ? d : "operation_failed", typeof f.active_jobs == "number" ? f.active_jobs : void 0);
}
function ul({ value: n }) {
  const o = h4(n);
  return /* @__PURE__ */ (0, y.jsx)(Gi, {
    className: "admin-status-badge",
    size: "sm",
    radius: "xl",
    variant: "light",
    "data-tone": o,
    color: o === "warning" ? "yellow" : o === "error" ? "red" : "gray",
    children: Pe(n)
  });
}
function Ci({ id: n, eyebrow: o, title: r, error: i, actions: c, children: f }) {
  return /* @__PURE__ */ (0, y.jsxs)("section", {
    id: n,
    className: "admin-section",
    "aria-labelledby": `${n}-title`,
    children: [
      /* @__PURE__ */ (0, y.jsxs)("div", {
        className: "section-heading",
        children: [/* @__PURE__ */ (0, y.jsxs)("div", { children: [/* @__PURE__ */ (0, y.jsx)("span", {
          className: "eyebrow",
          children: o
        }), /* @__PURE__ */ (0, y.jsx)("h2", {
          id: `${n}-title`,
          children: r
        })] }), c]
      }),
      i && /* @__PURE__ */ (0, y.jsx)(No, {
        color: "red",
        role: "alert",
        className: "section-error",
        children: i
      }),
      f
    ]
  });
}
function Tb({ label: n, headings: o, rows: r, empty: i }) {
  return r.length ? /* @__PURE__ */ (0, y.jsx)(bt.ScrollContainer, {
    className: "table-wrap",
    type: "native",
    minWidth: 960,
    role: "region",
    "aria-label": `${n} table. Scroll horizontally to view all fields.`,
    tabIndex: 0,
    children: /* @__PURE__ */ (0, y.jsxs)(bt, {
      stickyHeader: !0,
      className: "admin-data-table",
      children: [/* @__PURE__ */ (0, y.jsx)(bt.Thead, { children: /* @__PURE__ */ (0, y.jsx)(bt.Tr, { children: o.map((c) => /* @__PURE__ */ (0, y.jsx)(bt.Th, { children: c }, c)) }) }), /* @__PURE__ */ (0, y.jsx)(bt.Tbody, { children: r.map((c, f) => /* @__PURE__ */ (0, y.jsx)(bt.Tr, { children: c.map((d, m) => /* @__PURE__ */ (0, y.jsx)(bt.Td, { children: d }, m)) }, f)) })]
    })
  }) : /* @__PURE__ */ (0, y.jsx)("div", {
    className: "empty-state",
    children: i
  });
}
function x4({ project: n, onAction: o }) {
  const r = (0, S.useRef)(null), i = Pe(n.name || n.id);
  return /* @__PURE__ */ (0, y.jsxs)(Tt, {
    position: "bottom-end",
    shadow: "md",
    width: 176,
    children: [/* @__PURE__ */ (0, y.jsx)(Tt.Target, { children: /* @__PURE__ */ (0, y.jsx)(ln, {
      ref: r,
      variant: "subtle",
      color: "gray",
      size: "xs",
      rightSection: /* @__PURE__ */ (0, y.jsx)(QN, { size: 16 }),
      "aria-label": `Actions for ${i}`,
      children: "Actions"
    }) }), /* @__PURE__ */ (0, y.jsx)(Tt.Dropdown, { children: [
      "enable",
      "disable",
      "unregister"
    ].map((c) => /* @__PURE__ */ (0, y.jsx)(Tt.Item, {
      color: c === "unregister" ? "red" : void 0,
      disabled: La(n.actions)[c] !== !0,
      onClick: () => {
        r.current && o(c, n, r.current);
      },
      children: c[0].toUpperCase() + c.slice(1)
    }, c)) })]
  });
}
function w4() {
  const [n, o] = (0, S.useState)(y4), [r, i] = (0, S.useState)(Ux), [c, f] = (0, S.useState)(""), [d, m] = (0, S.useState)(!1), [h, g] = (0, S.useState)(!1), w = (0, S.useRef)(0), b = (0, S.useRef)(!1), [v, x] = (0, S.useState)(""), [E, C] = (0, S.useState)(Cb), [_, R] = (0, S.useState)("Locked"), [M, A] = (0, S.useState)(""), [O, D] = (0, S.useState)(!0), [j, $] = (0, S.useState)("overview-section"), H = (0, S.useRef)(null);
  qx(H, j, {
    variant: "filled",
    itemSelector: "a",
    selectedSelector: "a[aria-current]"
  });
  const [X, J] = (0, S.useState)(null), [W, ie] = (0, S.useState)(zc), [ae, q] = (0, S.useState)(""), [me, B] = (0, S.useState)(!1), G = (0, S.useRef)(!1), k = (0, S.useRef)(null), I = (0, S.useRef)(null), ee = (0, S.useRef)(null), te = (0, S.useRef)(null), ne = () => {
    G.current = !1, J(null);
  }, ce = (Q = "Locked.") => {
    w.current += 1, b.current = !1, g(!1), te.current?.closeForSessionEnd(), ee.current?.lock(), I.current?.lock(Q), C(Cb), f(""), B(!1), q(""), A("");
  };
  I.current || (I.current = new r4({
    request: b4,
    render: (Q) => C((Se) => v4(Se, Q)),
    showAuthenticated: () => {
      m(!0), x("");
    },
    showLocked: (Q) => {
      m(!1), x(Q), R("Locked");
    },
    setStatus: R,
    showError: A,
    clearError: () => A(""),
    onUnauthorized: () => ce("Administrator authentication required.")
  })), ee.current || (ee.current = new s4({
    request: S4,
    keyFactory: () => crypto.randomUUID(),
    refresh: () => I.current.invalidateAndRefresh(),
    outcome: (Q) => {
      R(Q), te.current?.cancel();
    },
    error: (Q) => q(g4[Q]),
    pending: (Q, Se) => B(Se),
    lock: (Q) => ce(Q)
  })), te.current || (te.current = new c4(ee.current, {
    close: ne,
    isOpen: () => G.current,
    clearSensitive: () => ie(zc),
    restoreFocus: () => {
      const Q = k.current;
      k.current = null, window.setTimeout(() => {
        Q?.isConnected && Q.focus();
      }, 0);
    }
  })), (0, S.useEffect)(() => {
    const Q = window.matchMedia?.("(prefers-color-scheme: dark)"), Se = () => {
      const _e = n === "system" ? Q?.matches ? "dark" : "light" : n;
      document.documentElement.dataset.theme = n, document.documentElement.dataset.resolvedTheme = _e, RN(r, _e), document.querySelector('meta[name="theme-color"]')?.setAttribute("content", _e === "dark" ? "#0b0b0c" : "#f5f5f5");
    };
    Se();
    try {
      localStorage.setItem(ow, n);
    } catch {
    }
    return Q?.addEventListener?.("change", Se), () => Q?.removeEventListener?.("change", Se);
  }, [n, r]), (0, S.useEffect)(() => {
    const Q = (Se) => {
      const _e = Se instanceof StorageEvent ? Se.key === "webcodex.ui.accent.v1" ? Va(Se.newValue) : null : Va(Se.detail);
      _e && i(_e);
    };
    return window.addEventListener(Li, Q), window.addEventListener("storage", Q), () => {
      window.removeEventListener(Li, Q), window.removeEventListener("storage", Q);
    };
  }, []), (0, S.useEffect)(() => {
    const Q = () => ce();
    return window.addEventListener("pagehide", Q), () => {
      window.removeEventListener("pagehide", Q), te.current?.closeForSessionEnd(), ee.current?.dispose(), I.current?.dispose();
    };
  }, []), (0, S.useEffect)(() => {
    if (!X || X.kind === "register" || X.kind === "create" || !ae.startsWith("Project state changed")) return;
    const Q = E.projects.find((Se) => String(Se.id || "") === X.target);
    Q && Q.revision !== X.project?.revision && J((Se) => Se?.target === X.target ? {
      ...Se,
      project: Q
    } : Se);
  }, [
    E.projects,
    X,
    ae
  ]), (0, S.useEffect)(() => {
    if (!d) return;
    let Q = 0;
    const Se = () => {
      Q = 0;
      const Ae = [
        "overview-section",
        "devices-section",
        "projects-section",
        "diagnostics-section"
      ].map((ct) => document.getElementById(ct)).filter((ct) => !!ct), Oe = (window.innerWidth <= 700 ? 80 : 32) + 1, We = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 ? Ae.at(-1) : Ae.filter((ct) => ct.getBoundingClientRect().top <= Oe).at(-1) || Ae[0];
      We && $(We.id);
    }, _e = () => {
      Q || (Q = window.requestAnimationFrame(Se));
    };
    return window.addEventListener("scroll", _e, { passive: !0 }), window.addEventListener("resize", _e), () => {
      window.removeEventListener("scroll", _e), window.removeEventListener("resize", _e), window.cancelAnimationFrame(Q);
    };
  }, [d]);
  const fe = async (Q) => {
    if (Q.preventDefault(), b.current) return;
    const Se = c.trim();
    if (f(""), !Se) return;
    const _e = ++w.current;
    b.current = !0, g(!0), x(""), te.current.closeForSessionEnd(), ee.current.beginSession(Se);
    try {
      await I.current.beginSession(Se), _e === w.current && O && I.current.startAutoRefresh(Eb);
    } finally {
      _e === w.current && (b.current = !1, g(!1));
    }
  }, N = (Q) => {
    D(Q), Q ? I.current.startAutoRefresh(Eb) : I.current.stopAutoRefresh();
  }, Z = (Q) => {
    i(Q), _N(Q);
  }, ue = () => o((Q) => Q === "system" ? "light" : Q === "light" ? "dark" : "system"), re = (Q, Se) => {
    const _e = `${Q}:${crypto.randomUUID()}`;
    te.current.open(_e), k.current = Se, ie(zc), q(""), G.current = !0, J({
      kind: Q,
      target: _e
    });
  }, ge = (Q, Se, _e) => {
    const Ae = String(Se.id || ""), Oe = {
      project: Ae,
      expected_revision: String(Se.revision || ""),
      confirm: !0
    }, We = ee.current.start(Q, Ae, Oe);
    te.current.open(Ae, We, Oe), k.current = _e, ie(zc), q(""), G.current = !0, J({
      kind: Q,
      target: Ae,
      project: Se
    });
  }, he = (Q) => {
    if (Q.preventDefault(), !X || me) return;
    const { kind: Se, target: _e } = X;
    let Ae;
    if (Se === "register" || Se === "create" ? (Ae = {
      client_id: W.client_id.trim(),
      project_id: W.project_id.trim(),
      name: W.name.trim(),
      description: W.description.trim() || null,
      path: W.path.trim(),
      allow_patch: W.allow_patch
    }, Se === "create" && Object.assign(Ae, {
      git_init: W.git_init,
      template: W.template.trim() || null,
      adopt_existing_empty: W.adopt_existing_empty
    })) : Ae = {
      project: _e,
      expected_revision: String(X.project?.revision || ""),
      confirm: !0
    }, Se === "unregister" && W.confirm_project !== _e) {
      q("Type the full runtime project ID to confirm.");
      return;
    }
    q(""), te.current.submit(Se, Ae);
  }, ye = (Q, Se) => ie((_e) => ({
    ..._e,
    [Q]: Se
  })), ve = (Q) => E.errors[Q], de = E.overview, Ne = [
    [
      "Server",
      Pe(de.version),
      `${Pe(de.build_commit)} · ${Pe(de.authority_mode)}`
    ],
    [
      "Runners",
      `${Pe(de.runners_online || 0)} / ${Pe(de.runners_total || 0)}`,
      "online now"
    ],
    [
      "Projects",
      `${Pe(de.projects_online || 0)} / ${Pe(de.projects_total || 0)}`,
      "ready for work"
    ],
    [
      "Jobs",
      Pe(de.active_jobs || 0),
      Pe(de.version_compatibility || "compatibility unknown")
    ]
  ];
  return /* @__PURE__ */ (0, y.jsxs)("div", {
    className: "admin-shell ui-canvas",
    children: [
      /* @__PURE__ */ (0, y.jsxs)("aside", {
        className: "admin-rail ui-surface",
        "aria-label": "WebCodex Admin navigation",
        children: [
          /* @__PURE__ */ (0, y.jsxs)("div", {
            className: "product-identity",
            children: [/* @__PURE__ */ (0, y.jsx)(d4, {}), /* @__PURE__ */ (0, y.jsxs)("div", { children: [/* @__PURE__ */ (0, y.jsx)("strong", { children: "WebCodex" }), /* @__PURE__ */ (0, y.jsx)("span", { children: "Admin console" })] })]
          }),
          /* @__PURE__ */ (0, y.jsx)("nav", {
            ref: H,
            className: "section-nav",
            "aria-label": "Dashboard sections",
            children: [
              [
                "overview-section",
                "Overview",
                KN
              ],
              [
                "devices-section",
                "Runners",
                o4
              ],
              [
                "projects-section",
                "Projects",
                ZN
              ],
              [
                "diagnostics-section",
                "Diagnostics",
                a4
              ]
            ].map(([Q, Se, _e]) => /* @__PURE__ */ (0, y.jsxs)("a", {
              href: `#${Q}`,
              "aria-current": j === Q ? "location" : void 0,
              "aria-label": Se,
              title: Se,
              onClick: () => $(Q),
              children: [/* @__PURE__ */ (0, y.jsx)(_e, {
                size: 18,
                "aria-hidden": "true"
              }), /* @__PURE__ */ (0, y.jsx)("span", { children: Se })]
            }, Q))
          }),
          /* @__PURE__ */ (0, y.jsxs)("div", {
            className: "rail-footer",
            children: [/* @__PURE__ */ (0, y.jsxs)("p", {
              className: "rail-status",
              children: [/* @__PURE__ */ (0, y.jsx)("span", { "aria-hidden": "true" }), " Control plane"]
            }), /* @__PURE__ */ (0, y.jsx)("div", {
              className: "admin-preference-buttons",
              role: "group",
              "aria-label": "Preferences",
              children: /* @__PURE__ */ (0, y.jsx)(u4, {
                accent: r,
                appearance: n,
                onAccentChange: Z,
                onAppearanceCycle: ue
              })
            })]
          })
        ]
      }),
      /* @__PURE__ */ (0, y.jsx)("main", {
        className: "admin-workspace",
        children: d ? /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
          /* @__PURE__ */ (0, y.jsxs)("header", {
            className: "workspace-toolbar ui-surface",
            children: [/* @__PURE__ */ (0, y.jsxs)("div", {
              className: "page-context",
              children: [/* @__PURE__ */ (0, y.jsx)("span", {
                className: "eyebrow",
                children: "Control plane"
              }), /* @__PURE__ */ (0, y.jsx)("h1", { children: "Operations" })]
            }), /* @__PURE__ */ (0, y.jsxs)("div", {
              className: "toolbar-actions",
              children: [
                /* @__PURE__ */ (0, y.jsx)(Gi, {
                  color: "gray",
                  variant: "light",
                  className: "status",
                  role: "status",
                  children: _
                }),
                /* @__PURE__ */ (0, y.jsx)(Qi, {
                  label: "Live",
                  checked: O,
                  onChange: (Q) => N(Q.currentTarget.checked),
                  size: "sm"
                }),
                /* @__PURE__ */ (0, y.jsx)(ln, {
                  variant: "default",
                  leftSection: /* @__PURE__ */ (0, y.jsx)(t4, { size: 15 }),
                  onClick: () => {
                    I.current.refresh();
                  },
                  children: "Refresh"
                }),
                /* @__PURE__ */ (0, y.jsx)(ln, {
                  variant: "subtle",
                  color: "gray",
                  onClick: () => ce(),
                  children: "Lock"
                })
              ]
            })]
          }),
          M && /* @__PURE__ */ (0, y.jsx)(No, {
            color: "red",
            role: "alert",
            className: "workspace-error",
            children: M
          }),
          /* @__PURE__ */ (0, y.jsx)(Ci, {
            id: "overview-section",
            eyebrow: "At a glance",
            title: "System flow",
            error: ve("overview"),
            children: /* @__PURE__ */ (0, y.jsx)("div", {
              className: "overview-strip",
              children: Ne.map(([Q, Se, _e], Ae) => /* @__PURE__ */ (0, y.jsxs)("div", {
                className: "overview-item",
                children: [
                  /* @__PURE__ */ (0, y.jsx)("span", { children: Q }),
                  /* @__PURE__ */ (0, y.jsx)("strong", {
                    className: Ae ? "metric" : "",
                    children: Se
                  }),
                  /* @__PURE__ */ (0, y.jsx)("small", { children: _e })
                ]
              }, Q))
            })
          }),
          /* @__PURE__ */ (0, y.jsx)(Ci, {
            id: "devices-section",
            eyebrow: "Connected fleet",
            title: "Runners",
            error: ve("devices"),
            children: /* @__PURE__ */ (0, y.jsx)(Tb, {
              label: "Connected Runners",
              empty: "No Runners observed.",
              headings: [
                "Name",
                "Client",
                "Status",
                "Transport",
                "Host",
                "Last seen",
                "Capabilities",
                "Projects",
                "Jobs",
                "Protocol",
                "Build alignment"
              ],
              rows: E.devices.map((Q) => [
                Pe(Q.display_name),
                /* @__PURE__ */ (0, y.jsx)("code", { children: Pe(Q.client_id) }),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.status }),
                Pe(Q.transport),
                Pe(Q.hostname),
                /* @__PURE__ */ (0, y.jsx)("code", { children: Pe(Q.last_seen) }),
                Pe(m4(Q.capabilities).join(", ")),
                Pe(Q.project_count),
                Pe(Q.active_jobs),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.protocol_compatibility || Q.compatibility }),
                /* @__PURE__ */ (0, y.jsx)("span", {
                  title: "Build identity is diagnostic, not functional compatibility",
                  children: Pe(Q.build_alignment)
                })
              ])
            })
          }),
          /* @__PURE__ */ (0, y.jsx)(Ci, {
            id: "projects-section",
            eyebrow: "Runtime registry",
            title: "Projects",
            error: ve("projects"),
            actions: /* @__PURE__ */ (0, y.jsxs)("div", {
              className: "section-actions",
              children: [/* @__PURE__ */ (0, y.jsx)(ln, {
                variant: "default",
                onClick: (Q) => re("register", Q.currentTarget),
                children: "Register"
              }), /* @__PURE__ */ (0, y.jsx)(ln, {
                className: "admin-primary",
                leftSection: /* @__PURE__ */ (0, y.jsx)(e4, { size: 15 }),
                onClick: (Q) => re("create", Q.currentTarget),
                children: "Create project"
              })]
            }),
            children: /* @__PURE__ */ (0, y.jsx)(Tb, {
              label: "Projects",
              empty: "No projects registered.",
              headings: [
                "Runtime project",
                "Name",
                "Client",
                "Path",
                "Lifecycle",
                "Jobs",
                "Git",
                "Patch",
                "Shell profile",
                "Protocol",
                "Build alignment",
                "Console",
                "Actions"
              ],
              rows: E.projects.map((Q) => [
                /* @__PURE__ */ (0, y.jsx)("code", { children: Pe(Q.id) }),
                LN({
                  name: String(Q.name || ""),
                  path: String(Q.path || ""),
                  id: String(Q.id || "")
                }),
                Pe(Q.client_id),
                /* @__PURE__ */ (0, y.jsx)("code", {
                  title: Im(String(Q.path || "")),
                  children: Pe(Im(String(Q.path || "")))
                }),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.lifecycle_status || Q.readiness }),
                Pe(Q.active_jobs),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.git_available }),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.allow_patch }),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.shell_profile_status }),
                /* @__PURE__ */ (0, y.jsx)(ul, { value: Q.protocol_compatibility || Q.compatibility }),
                /* @__PURE__ */ (0, y.jsx)("span", {
                  title: "Build identity is diagnostic, not functional compatibility",
                  children: Pe(Q.build_alignment)
                }),
                Pe(Q.console_hint),
                /* @__PURE__ */ (0, y.jsx)(x4, {
                  project: Q,
                  onAction: ge
                })
              ])
            })
          }),
          /* @__PURE__ */ (0, y.jsxs)("div", {
            className: "details-grid",
            children: [/* @__PURE__ */ (0, y.jsxs)(Ci, {
              id: "diagnostics-section",
              eyebrow: "System evidence",
              title: "Diagnostics",
              children: [/* @__PURE__ */ (0, y.jsx)("dl", { children: Object.entries(E.diagnostics).map(([Q, Se]) => /* @__PURE__ */ (0, y.jsxs)("div", { children: [/* @__PURE__ */ (0, y.jsx)("dt", { children: Q.replace(/_/g, " ") }), /* @__PURE__ */ (0, y.jsx)("dd", { children: Pe(Se) })] }, Q)) }), !Object.keys(E.diagnostics).length && /* @__PURE__ */ (0, y.jsx)("div", {
                className: "empty-state",
                children: "No diagnostics available."
              })]
            }), /* @__PURE__ */ (0, y.jsx)(Ci, {
              id: "activity-section",
              eyebrow: "Recent events",
              title: "Recent activity",
              error: ve("activity"),
              children: E.activity.length ? /* @__PURE__ */ (0, y.jsx)("ol", {
                className: "activity-list",
                children: E.activity.map((Q, Se) => /* @__PURE__ */ (0, y.jsxs)("li", { children: [/* @__PURE__ */ (0, y.jsx)(XN, {
                  size: 15,
                  "aria-hidden": "true"
                }), /* @__PURE__ */ (0, y.jsx)("span", { children: [
                  Q.created_at,
                  Q.kind,
                  Q.project_id,
                  Q.status
                ].filter(Boolean).map(String).join(" · ") })] }, Se))
              }) : /* @__PURE__ */ (0, y.jsx)("div", {
                className: "empty-state",
                children: "No recent bounded activity."
              })
            })]
          })
        ] }) : /* @__PURE__ */ (0, y.jsxs)("section", {
          className: "gate ui-workbench-surface",
          "aria-labelledby": "gate-title",
          children: [
            /* @__PURE__ */ (0, y.jsx)("div", {
              className: "gate-icon",
              children: /* @__PURE__ */ (0, y.jsx)(FN, { size: 22 })
            }),
            /* @__PURE__ */ (0, y.jsx)("span", {
              className: "eyebrow",
              children: "Secure control plane"
            }),
            /* @__PURE__ */ (0, y.jsx)("h1", {
              id: "gate-title",
              children: "Administrator access"
            }),
            /* @__PURE__ */ (0, y.jsx)("p", { children: "Use a bootstrap token or admin-scoped PAT. The token stays only in this page’s memory." }),
            /* @__PURE__ */ (0, y.jsxs)("form", {
              onSubmit: (Q) => {
                fe(Q);
              },
              autoComplete: "off",
              className: "gate-form",
              children: [/* @__PURE__ */ (0, y.jsx)(Xi, {
                label: "Admin token",
                "aria-label": "Admin token",
                autoComplete: "off",
                value: c,
                disabled: h,
                onChange: (Q) => f(Q.currentTarget.value),
                placeholder: "Enter admin token"
              }), /* @__PURE__ */ (0, y.jsx)(ln, {
                type: "submit",
                className: "admin-primary",
                loading: h,
                "aria-busy": h,
                children: "Unlock console"
              })]
            }),
            (v || M) && /* @__PURE__ */ (0, y.jsx)(No, {
              color: "red",
              role: "alert",
              mt: "md",
              children: v || M
            })
          ]
        })
      }),
      /* @__PURE__ */ (0, y.jsx)(kn, {
        opened: X !== null,
        onClose: () => te.current?.handleCancel({ preventDefault() {
        } }),
        returnFocus: !1,
        closeOnEscape: !me,
        closeOnClickOutside: !me,
        withCloseButton: !me,
        closeButtonProps: { "aria-label": "Close dialog" },
        title: X ? `${X.kind[0].toUpperCase()}${X.kind.slice(1)} project` : "Project operation",
        centered: !0,
        size: "lg",
        classNames: {
          content: "admin-modal-content",
          header: "admin-modal-header",
          title: "admin-modal-title",
          body: "admin-modal-body"
        },
        children: X && /* @__PURE__ */ (0, y.jsxs)("form", {
          onSubmit: he,
          autoComplete: "off",
          className: "dialog-form",
          children: [
            X.kind === "register" || X.kind === "create" ? /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsx)("p", { children: X.kind === "create" ? "Create may create a directory and Git repository. An existing empty directory is used only when explicitly adopted; non-empty directories are never overwritten." : "Register an existing directory. The path remains only in this form and page memory." }), /* @__PURE__ */ (0, y.jsxs)("div", {
              className: "dialog-fields",
              children: [
                /* @__PURE__ */ (0, y.jsx)(Pn, {
                  required: !0,
                  label: "Client ID",
                  value: W.client_id,
                  onChange: (Q) => ye("client_id", Q.currentTarget.value)
                }),
                /* @__PURE__ */ (0, y.jsx)(Pn, {
                  required: !0,
                  label: "Project ID",
                  value: W.project_id,
                  onChange: (Q) => ye("project_id", Q.currentTarget.value)
                }),
                /* @__PURE__ */ (0, y.jsx)(Pn, {
                  required: !0,
                  label: "Name",
                  value: W.name,
                  onChange: (Q) => ye("name", Q.currentTarget.value)
                }),
                /* @__PURE__ */ (0, y.jsx)(Pn, {
                  label: "Description",
                  value: W.description,
                  onChange: (Q) => ye("description", Q.currentTarget.value)
                }),
                /* @__PURE__ */ (0, y.jsx)(Pn, {
                  required: !0,
                  label: "Path",
                  value: W.path,
                  onChange: (Q) => ye("path", Q.currentTarget.value)
                }),
                /* @__PURE__ */ (0, y.jsx)(ka, {
                  label: "Allow patch",
                  checked: W.allow_patch,
                  onChange: (Q) => ye("allow_patch", Q.currentTarget.checked)
                }),
                X.kind === "create" && /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [
                  /* @__PURE__ */ (0, y.jsx)(ka, {
                    label: "Initialize Git repository",
                    checked: W.git_init,
                    onChange: (Q) => ye("git_init", Q.currentTarget.checked)
                  }),
                  /* @__PURE__ */ (0, y.jsx)(Pn, {
                    label: "Template",
                    value: W.template,
                    onChange: (Q) => ye("template", Q.currentTarget.value)
                  }),
                  /* @__PURE__ */ (0, y.jsx)(ka, {
                    label: "Adopt existing empty directory",
                    checked: W.adopt_existing_empty,
                    onChange: (Q) => ye("adopt_existing_empty", Q.currentTarget.checked)
                  })
                ] })
              ]
            })] }) : /* @__PURE__ */ (0, y.jsxs)("div", {
              className: "action-confirmation",
              children: [
                /* @__PURE__ */ (0, y.jsxs)("p", { children: [/* @__PURE__ */ (0, y.jsx)("strong", { children: "Project" }), /* @__PURE__ */ (0, y.jsx)("code", { children: X.target })] }),
                /* @__PURE__ */ (0, y.jsxs)("p", { children: [/* @__PURE__ */ (0, y.jsx)("strong", { children: "Revision" }), /* @__PURE__ */ (0, y.jsx)("code", { children: Pe(X.project?.revision) })] }),
                /* @__PURE__ */ (0, y.jsxs)("p", { children: [/* @__PURE__ */ (0, y.jsx)("strong", { children: "Active jobs" }), /* @__PURE__ */ (0, y.jsx)("span", { children: Pe(X.project?.active_jobs ?? 0) })] }),
                X.kind === "disable" && /* @__PURE__ */ (0, y.jsx)("small", { children: "Already-started jobs will not be stopped. Project configuration and source directory are retained." }),
                X.kind === "enable" && /* @__PURE__ */ (0, y.jsx)("small", { children: "This only re-enables a registered project. The Agent revalidates path policy." }),
                X.kind === "unregister" && /* @__PURE__ */ (0, y.jsxs)(y.Fragment, { children: [/* @__PURE__ */ (0, y.jsx)("small", { children: "Only the Agent registry record is removed. The source directory and .git are not deleted. Active jobs cause rejection." }), /* @__PURE__ */ (0, y.jsx)(Pn, {
                  required: !0,
                  label: "Type the full runtime project ID to confirm",
                  value: W.confirm_project,
                  onChange: (Q) => ye("confirm_project", Q.currentTarget.value)
                })] })
              ]
            }),
            ae && /* @__PURE__ */ (0, y.jsx)(No, {
              color: "red",
              role: "alert",
              children: ae
            }),
            /* @__PURE__ */ (0, y.jsxs)("div", {
              className: "dialog-actions",
              children: [/* @__PURE__ */ (0, y.jsx)(ln, {
                variant: "default",
                type: "button",
                disabled: me,
                onClick: () => te.current?.cancel(),
                children: "Cancel"
              }), /* @__PURE__ */ (0, y.jsx)(ln, {
                type: "submit",
                className: "admin-primary",
                loading: me,
                "aria-busy": me,
                children: "Continue"
              })]
            })
          ]
        })
      })
    ]
  });
}
document.documentElement.dataset.uiRenderer = "admin";
var rw = document.getElementById("root");
if (!rw) throw new Error("Admin root element is missing");
(0, CN.createRoot)(rw).render(/* @__PURE__ */ (0, y.jsx)(S.StrictMode, { children: /* @__PURE__ */ (0, y.jsx)(zN, { children: /* @__PURE__ */ (0, y.jsx)(w4, {}) }) }));
