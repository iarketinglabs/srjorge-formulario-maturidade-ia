// Porte vanilla-JS (fiel) do campo de partículas atômicas usado na LP Portefólio
// Pedro Armbrust (src/components/particle-field.tsx). Física idêntica: núcleons
// ciano formam átomos por Lennard-Jones/union-find; elétrons amarelo/vermelho
// orbitam em plano 3D projetado (Kepler); ponteiro quebra átomos ao toque.
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var COLORS = {
    ciano: "99, 190, 194",
    amarelo: "255, 185, 0",
    vermelho: "238, 110, 105"
  };

  // ── Física ──────────────────────────────────────────────────
  var LJ_EQUILIBRIUM = 10;
  var LJ_EPSILON = 0.012;
  var LJ_ATTRACT_MAX = 38;
  var LJ_FORCE_CLAMP = 0.12;
  var BOND_RADIUS = 30;

  var ORBIT_SPEED_MAX = 0.006;
  var ORBIT_BASE = 28;
  var ORBIT_SHELL_GAP = 10;
  var ORBIT_CONVERGE = 0.005;

  var PTR_RADIUS = 155;
  var PTR_PUSH_FREE = 0.10;
  var PTR_PUSH_NUCLEUS = 0.55;
  var PTR_PUSH_ELEC = 0.30;
  var PTR_BREAK_THRESH = 0.12;

  var BREAK_COOLDOWN = 100;

  var ATOM_GRAVITY_G = 35;
  var FUSION_APPROACH = 130;
  var FUSION_MERGE = 24;
  var ATOM_GRAVITY_MAX = 0.012;

  var ELEC_ATTRACT_G = 0.00018;
  var ELEC_ATTRACT_MAX = 100;
  var ELEC_MASS_MAX = 2.5;

  var VEL_DAMPING = 0.988;
  var EXCITATION_DECAY = 0.97;

  var DRIFT_FORCE = 0.0022;
  var DRIFT_ROT_SPEED = 0.008;

  var FORMATION_DELAY = 4000;
  var FORMATION_RAMP = 10000;

  var TRAIL_LENGTH = 550;
  var TRAIL_STEP_PX = 0.8;

  function init() {
    var stage = document.createElement("div");
    stage.className = "particle-stage";
    stage.setAttribute("aria-hidden", "true");
    var canvas = document.createElement("canvas");
    var overlay = document.createElement("div");
    overlay.className = "particle-vintage-overlay";
    stage.appendChild(canvas);
    stage.appendChild(overlay);
    document.body.insertBefore(stage, document.body.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var width = window.innerWidth;
    var height = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var particles = [];
    var pointer = { x: 0, y: 0, active: false };
    var agitation = 0;
    var scrollResetTimer;
    var rafId;
    var idCounter = 0;
    var startTime = 0;
    var formationFactor = 0;

    function particleCount() {
      return Math.max(50, Math.min(130, Math.round((width * height) / 10000)));
    }

    function createParticles() {
      idCounter = 0;
      var count = particleCount();
      var cianoCount = Math.round(count * 0.28);
      var elecTotal = count - cianoCount;
      var amarelCount = Math.round(elecTotal * 0.70);
      var vermelhoCount = elecTotal - amarelCount;

      function makeCiano() {
        return {
          id: idCounter++,
          x: Math.random() * width, y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.03,
          vy: (Math.random() - 0.5) * 0.03,
          radius: Math.random() * 1.8 + 1.2, hue: "ciano",
          atomId: null, role: "free",
          orbitAngle: 0, orbitSpeed: 0,
          orbitRadius: 0, orbitRadiusTarget: 0,
          inclination: 0, ascendingNode: 0,
          z: 0, excitation: 0, _depthScale: 1,
          breakCooldown: 0,
          driftAngle: Math.random() * Math.PI * 2,
          trail: []
        };
      }

      function makeElec(hue) {
        return {
          id: idCounter++,
          x: Math.random() * width, y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.03,
          vy: (Math.random() - 0.5) * 0.03,
          radius: Math.random() * 1.2 + 0.8, hue: hue,
          atomId: null, role: "free",
          orbitAngle: Math.random() * Math.PI * 2,
          orbitSpeed: 0,
          orbitRadius: 0, orbitRadiusTarget: 0,
          inclination: 0, ascendingNode: 0,
          z: 0, excitation: 0, _depthScale: 1,
          breakCooldown: 0,
          driftAngle: Math.random() * Math.PI * 2,
          trail: []
        };
      }

      particles = [];
      for (var i = 0; i < cianoCount; i++) particles.push(makeCiano());
      for (var j = 0; j < amarelCount; j++) particles.push(makeElec("amarelo"));
      for (var k = 0; k < vermelhoCount; k++) particles.push(makeElec("vermelho"));
    }

    function buildAtoms(parts, byId) {
      var cianos = parts.filter(function (p) { return p.hue === "ciano" && p.breakCooldown <= 0; });
      var n = cianos.length;
      var parent = new Int32Array(n);
      for (var i = 0; i < n; i++) parent[i] = i;

      function find(i) {
        while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
        return i;
      }

      for (var a = 0; a < n; a++) {
        for (var b = a + 1; b < n; b++) {
          var dx = cianos[a].x - cianos[b].x;
          var dy = cianos[a].y - cianos[b].y;
          if (dx * dx + dy * dy < BOND_RADIUS * BOND_RADIUS) {
            var ri = find(a), rj = find(b);
            if (ri !== rj) {
              if (cianos[ri].id < cianos[rj].id) parent[rj] = ri;
              else parent[ri] = rj;
            }
          }
        }
      }

      var atomMap = new Map();
      for (var c = 0; c < n; c++) {
        var leaderId = cianos[find(c)].id;
        if (!atomMap.has(leaderId)) {
          atomMap.set(leaderId, { id: leaderId, cx: 0, cy: 0, vx: 0, vy: 0, nucleusIds: [], electronIds: [] });
        }
        var atom = atomMap.get(leaderId);
        atom.nucleusIds.push(cianos[c].id);
        cianos[c].atomId = leaderId;
        cianos[c].role = "nucleus";
      }

      parts.forEach(function (p) {
        if (p.hue === "ciano" && p.breakCooldown > 0) { p.atomId = null; p.role = "free"; }
      });

      atomMap.forEach(function (atom) {
        var cx = 0, cy = 0, vx = 0, vy = 0;
        atom.nucleusIds.forEach(function (nid) {
          var np = byId.get(nid);
          cx += np.x; cy += np.y; vx += np.vx; vy += np.vy;
        });
        var len = atom.nucleusIds.length;
        atom.cx = cx / len; atom.cy = cy / len;
        atom.vx = vx / len; atom.vy = vy / len;
      });

      parts.forEach(function (p) {
        if (p.hue === "ciano" || p.role !== "electron") return;
        if (p.atomId !== null && atomMap.has(p.atomId)) {
          atomMap.get(p.atomId).electronIds.push(p.id);
        } else {
          p.atomId = null; p.role = "free";
        }
      });

      return atomMap;
    }

    function attractFreeElectrons(parts, atoms, ff) {
      if (ff < 0.01 || atoms.size === 0) return;
      parts.forEach(function (p) {
        if (p.hue === "ciano" || p.role !== "free") return;
        var bestDist = Infinity, bestAtom = null;
        atoms.forEach(function (atom) {
          var dx = atom.cx - p.x, dy = atom.cy - p.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < ELEC_ATTRACT_MAX && d < bestDist) { bestDist = d; bestAtom = atom; }
        });
        if (bestAtom && bestDist > 1) {
          var dx2 = bestAtom.cx - p.x, dy2 = bestAtom.cy - p.y;
          var nucleusSize = bestAtom.nucleusIds.length;
          var massFactor = Math.min(ELEC_MASS_MAX, 1 + (nucleusSize - 1) * 0.35);
          var acc = ELEC_ATTRACT_G * ff * (1 - bestDist / ELEC_ATTRACT_MAX) * massFactor;
          p.vx += (dx2 / bestDist) * acc;
          p.vy += (dy2 / bestDist) * acc;
        }
      });
    }

    function assignFreeElectrons(parts, atoms, ff) {
      if (ff < 0.01) return;
      parts.forEach(function (p) {
        if (p.hue === "ciano" || p.role !== "free") return;
        var bestDist = Infinity, bestAtom = null;
        atoms.forEach(function (atom) {
          var dx = p.x - atom.cx, dy = p.y - atom.cy;
          var d = Math.sqrt(dx * dx + dy * dy);
          var captureR = Math.min(ORBIT_BASE + ORBIT_SHELL_GAP * atom.electronIds.length + 12, 90);
          if (d < captureR && d < bestDist) { bestDist = d; bestAtom = atom; }
        });
        if (bestAtom && bestDist > 1) {
          var shellIdx = bestAtom.electronIds.length;
          p.atomId = bestAtom.id; p.role = "electron";
          p.orbitRadius = bestDist;
          p.orbitRadiusTarget = ORBIT_BASE + shellIdx * ORBIT_SHELL_GAP;

          p.inclination = (Math.random() - 0.5) * Math.PI * 0.6;
          p.ascendingNode = Math.random() * Math.PI * 2;

          var dx0 = p.x - bestAtom.cx, dy0 = p.y - bestAtom.cy;
          var cosN = Math.cos(p.ascendingNode), sinN = Math.sin(p.ascendingNode);
          var cosI = Math.cos(p.inclination);
          var projX = dx0 * cosN + dy0 * sinN;
          var projY = (-dx0 * sinN + dy0 * cosN) / Math.max(Math.abs(cosI), 0.3);
          p.orbitAngle = Math.atan2(projY, projX);

          var speed = ORBIT_SPEED_MAX * Math.sqrt(ORBIT_BASE / p.orbitRadiusTarget);
          p.orbitSpeed = (Math.random() < 0.5 ? 1 : -1) * speed;

          p.excitation = 0;
          bestAtom.electronIds.push(p.id);
        }
      });
    }

    function applyLennardJones(parts, atoms, byId, ff) {
      var maxAttrStrain = LJ_ATTRACT_MAX - LJ_EQUILIBRIUM;

      atoms.forEach(function (atom) {
        var nids = atom.nucleusIds;
        for (var i = 0; i < nids.length; i++) {
          for (var j = i + 1; j < nids.length; j++) {
            var pi = byId.get(nids[i]), pj = byId.get(nids[j]);
            var dx = pj.x - pi.x, dy = pj.y - pi.y;
            var distSq = dx * dx + dy * dy;
            if (distSq < 0.25 || distSq > LJ_ATTRACT_MAX * LJ_ATTRACT_MAX) continue;
            var dist = Math.sqrt(distSq);
            var strain = dist - LJ_EQUILIBRIUM;
            var f;
            if (strain < 0) {
              f = LJ_EPSILON * (strain / LJ_EQUILIBRIUM);
            } else {
              var s = strain / maxAttrStrain;
              f = LJ_EPSILON * s * (1 - s) * 4;
            }
            f = Math.max(-LJ_FORCE_CLAMP, Math.min(LJ_FORCE_CLAMP, f)) * ff;
            pi.vx += (dx / dist) * f; pi.vy += (dy / dist) * f;
            pj.vx -= (dx / dist) * f; pj.vy -= (dy / dist) * f;
          }
        }
      });

      var cianos = parts.filter(function (p) { return p.hue === "ciano"; });
      var crossMaxR = 200;
      var crossStrength = 0.0001 * ff;
      for (var i2 = 0; i2 < cianos.length; i2++) {
        for (var j2 = i2 + 1; j2 < cianos.length; j2++) {
          var pi2 = cianos[i2], pj2 = cianos[j2];
          if (pi2.atomId !== null && pi2.atomId === pj2.atomId) continue;
          var dx2 = pj2.x - pi2.x, dy2 = pj2.y - pi2.y;
          var distSq2 = dx2 * dx2 + dy2 * dy2;
          if (distSq2 > crossMaxR * crossMaxR || distSq2 < LJ_EQUILIBRIUM * LJ_EQUILIBRIUM) continue;
          var dist2 = Math.sqrt(distSq2);
          var acc2 = crossStrength * (1 - dist2 / crossMaxR);
          pi2.vx += (dx2 / dist2) * acc2; pi2.vy += (dy2 / dist2) * acc2;
          pj2.vx -= (dx2 / dist2) * acc2; pj2.vy -= (dy2 / dist2) * acc2;
        }
      }
    }

    function mergeAtoms(a, b, byId, atoms) {
      if (!atoms.has(a.id) || !atoms.has(b.id)) return;
      var survivor = a.nucleusIds.length >= b.nucleusIds.length ? a : b;
      var absorbed = survivor === a ? b : a;
      var mass = survivor.nucleusIds.length + absorbed.nucleusIds.length;
      var svx = (survivor.vx * survivor.nucleusIds.length + absorbed.vx * absorbed.nucleusIds.length) / mass;
      var svy = (survivor.vy * survivor.nucleusIds.length + absorbed.vy * absorbed.nucleusIds.length) / mass;

      absorbed.nucleusIds.forEach(function (nid) {
        var np = byId.get(nid);
        if (np) { np.atomId = survivor.id; np.vx = svx; np.vy = svy; }
        survivor.nucleusIds.push(nid);
      });
      survivor.nucleusIds.forEach(function (nid) {
        var np = byId.get(nid);
        if (np) { np.vx = svx; np.vy = svy; }
      });

      var allElec = survivor.electronIds.concat(absorbed.electronIds);
      survivor.electronIds = [];
      allElec.forEach(function (eid, i) {
        var ep = byId.get(eid);
        if (!ep) return;
        ep.atomId = survivor.id;
        ep.orbitRadiusTarget = ORBIT_BASE + i * ORBIT_SHELL_GAP;
        survivor.electronIds.push(eid);
      });

      atoms.delete(absorbed.id);
    }

    function applyAtomGravity(atoms, byId, ff) {
      if (atoms.size > 20 || ff < 0.01) return;
      var arr = Array.from(atoms.values());
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          var a = arr[i], b = arr[j];
          if (!atoms.has(a.id) || !atoms.has(b.id)) continue;
          var dx = b.cx - a.cx, dy = b.cy - a.cy;
          var distSq = dx * dx + dy * dy;
          if (distSq > FUSION_APPROACH * FUSION_APPROACH) continue;
          var dist = Math.sqrt(distSq);
          if (dist < 1) continue;
          if (dist < FUSION_MERGE) { mergeAtoms(a, b, byId, atoms); continue; }
          var totalMass = a.nucleusIds.length + b.nucleusIds.length;
          var acc = Math.min(ATOM_GRAVITY_MAX, (ATOM_GRAVITY_G / (distSq * totalMass)) * ff);
          var ax = (dx / dist) * acc, ay = (dy / dist) * acc;
          a.nucleusIds.forEach(function (nid) { var np = byId.get(nid); if (np) { np.vx += ax; np.vy += ay; } });
          b.nucleusIds.forEach(function (nid) { var np = byId.get(nid); if (np) { np.vx -= ax; np.vy -= ay; } });
        }
      }
    }

    function updateElectrons(parts, atoms) {
      parts.forEach(function (p) {
        if (p.role !== "electron") return;
        if (p.atomId === null || !atoms.has(p.atomId)) {
          p.role = "free"; p.atomId = null; p._depthScale = 1; p.trail = [];
          p.vx = (Math.random() - 0.5) * 0.1; p.vy = (Math.random() - 0.5) * 0.1;
          return;
        }
        if (p.hue !== "ciano") {
          var prev = p.trail.length > 0 ? p.trail[p.trail.length - 1] : null;
          if (!prev) {
            p.trail.push({ x: p.x, y: p.y });
          } else {
            var tdx = p.x - prev.x, tdy = p.y - prev.y;
            if (tdx * tdx + tdy * tdy >= TRAIL_STEP_PX * TRAIL_STEP_PX) {
              p.trail.push({ x: p.x, y: p.y });
              if (p.trail.length > TRAIL_LENGTH) p.trail.shift();
            }
          }
        }
        var atom = atoms.get(p.atomId);
        p.orbitAngle += p.orbitSpeed * (1 + p.excitation * 0.3);
        p.orbitRadius = Math.max(1, p.orbitRadius + (p.orbitRadiusTarget - p.orbitRadius) * ORBIT_CONVERGE);
        p.excitation *= EXCITATION_DECAY;
        if (agitation > 0.1) p.excitation = Math.min(1, p.excitation + agitation * 0.03);

        var r = p.orbitRadius;
        var cosA = Math.cos(p.orbitAngle), sinA = Math.sin(p.orbitAngle);
        var cosI = Math.cos(p.inclination), sinI = Math.sin(p.inclination);
        var cosN = Math.cos(p.ascendingNode), sinN = Math.sin(p.ascendingNode);
        var xOrb = r * cosA;
        var yOrb = r * sinA * cosI;
        p.z = r * sinA * sinI;
        p.x = atom.cx + xOrb * cosN - yOrb * sinN;
        p.y = atom.cy + xOrb * sinN + yOrb * cosN;
        p._depthScale = 0.65 + 0.35 * ((p.z / r + 1) / 2);
      });
    }

    function applyPointerForces(parts, atoms, byId) {
      if (!pointer.active) return;
      var brokenAtoms = new Set();

      parts.forEach(function (p) {
        var dx = p.x - pointer.x, dy = p.y - pointer.y;
        var distSq = dx * dx + dy * dy;
        if (distSq > PTR_RADIUS * PTR_RADIUS || distSq < 0.01) return;
        var dist = Math.sqrt(distSq);
        var proximity = 1 - dist / PTR_RADIUS;

        if (p.role === "nucleus" && p.atomId !== null && atoms.has(p.atomId)) {
          var atom = atoms.get(p.atomId);
          if (!brokenAtoms.has(atom.id)) {
            brokenAtoms.add(atom.id);

            atom.nucleusIds.forEach(function (nid) {
              var np = byId.get(nid);
              if (!np) return;
              np.atomId = null; np.role = "free"; np.excitation = 0.4;
              np.breakCooldown = BREAK_COOLDOWN;
              var ndx = np.x - pointer.x, ndy = np.y - pointer.y;
              var nd = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
              np.vx = (ndx / nd) * PTR_PUSH_NUCLEUS + (Math.random() - 0.5) * 0.3;
              np.vy = (ndy / nd) * PTR_PUSH_NUCLEUS + (Math.random() - 0.5) * 0.3;
            });

            atom.electronIds.forEach(function (eid) {
              var ep = byId.get(eid);
              if (!ep) return;
              ep.atomId = null; ep.role = "free"; ep._depthScale = 1; ep.excitation = 0.3; ep.trail = [];
              var edx = ep.x - pointer.x, edy = ep.y - pointer.y;
              var ed = Math.sqrt(edx * edx + edy * edy) || 1;
              ep.vx = (edx / ed) * PTR_PUSH_ELEC + (Math.random() - 0.5) * 0.2;
              ep.vy = (edy / ed) * PTR_PUSH_ELEC + (Math.random() - 0.5) * 0.2;
            });

            atoms.delete(atom.id);
          }
        } else if (p.role === "electron") {
          p.excitation = Math.min(1, p.excitation + proximity * 0.4);
          if (proximity > PTR_BREAK_THRESH) {
            p.role = "free"; p.atomId = null; p._depthScale = 1; p.trail = [];
            p.vx = (dx / dist) * PTR_PUSH_ELEC * proximity;
            p.vy = (dy / dist) * PTR_PUSH_ELEC * proximity;
          }
        } else {
          p.vx += (dx / dist) * proximity * PTR_PUSH_FREE;
          p.vy += (dy / dist) * proximity * PTR_PUSH_FREE;
        }
      });
    }

    function drawParticle(context, p) {
      var rgb = COLORS[p.hue];
      var isElec = p.role === "electron";
      var ds = isElec ? Math.max(0.65, p._depthScale) : 1;
      var r = p.radius * (isElec ? ds : 1);

      var auraR = r * 18;
      var auraA = (isElec ? 0.062 : 0.038) * ds;
      var aura = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, auraR);
      aura.addColorStop(0, "rgba(" + rgb + ", " + auraA.toFixed(4) + ")");
      aura.addColorStop(0.32, "rgba(" + rgb + ", " + (auraA * 0.38).toFixed(4) + ")");
      aura.addColorStop(1, "rgba(" + rgb + ", 0)");
      context.fillStyle = aura;
      context.beginPath(); context.arc(p.x, p.y, auraR, 0, Math.PI * 2); context.fill();

      var bodyR = r * 6.5;
      var bx = p.x - r * 0.22, by = p.y - r * 0.22;
      var wA = (0.22 * ds).toFixed(3);
      var cA = ((isElec ? 0.20 : 0.12) * ds).toFixed(3);
      var cA2 = ((isElec ? 0.07 : 0.04) * ds).toFixed(3);
      var body = context.createRadialGradient(bx, by, 0, p.x, p.y, bodyR);
      body.addColorStop(0, "rgba(255, 255, 255, " + wA + ")");
      body.addColorStop(0.20, "rgba(" + rgb + ", " + cA + ")");
      body.addColorStop(0.58, "rgba(" + rgb + ", " + cA2 + ")");
      body.addColorStop(1, "rgba(" + rgb + ", 0)");
      context.fillStyle = body;
      context.beginPath(); context.arc(p.x, p.y, bodyR, 0, Math.PI * 2); context.fill();

      var sx = p.x - r * 0.58, sy = p.y - r * 0.58;
      var specR = r * 1.8;
      var specA = (0.30 * ds).toFixed(3);
      var specA2 = (0.05 * ds).toFixed(3);
      var spec = context.createRadialGradient(sx, sy, 0, sx, sy, specR);
      spec.addColorStop(0, "rgba(255, 255, 255, " + specA + ")");
      spec.addColorStop(0.52, "rgba(255, 255, 255, " + specA2 + ")");
      spec.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = spec;
      context.beginPath(); context.arc(sx, sy, specR, 0, Math.PI * 2); context.fill();
    }

    function drawNuclearBonds(context, atoms, byId) {
      context.strokeStyle = "rgba(99, 190, 194, 0.07)";
      context.lineWidth = 0.5;
      var bondDistSq = Math.pow(LJ_EQUILIBRIUM * 2.4, 2);
      atoms.forEach(function (atom) {
        var nids = atom.nucleusIds;
        for (var i = 0; i < nids.length; i++) {
          for (var j = i + 1; j < nids.length; j++) {
            var pi = byId.get(nids[i]), pj = byId.get(nids[j]);
            if (!pi || !pj) continue;
            var dx = pi.x - pj.x, dy = pi.y - pj.y;
            if (dx * dx + dy * dy > bondDistSq) continue;
            context.beginPath(); context.moveTo(pi.x, pi.y); context.lineTo(pj.x, pj.y); context.stroke();
          }
        }
      });
    }

    function drawTrail(context, p) {
      var len = p.trail.length;
      if (len < 2) return;
      for (var i = 1; i < len; i++) {
        var t = i / len;
        var alpha = t * t * 0.07;
        context.beginPath();
        context.strokeStyle = "rgba(42, 52, 57, " + alpha.toFixed(4) + ")";
        context.lineWidth = 0.15 + 0.5 * t;
        context.lineCap = "round";
        context.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        context.lineTo(p.trail[i].x, p.trail[i].y);
        context.stroke();
      }
      if (len >= 1) {
        context.beginPath();
        context.strokeStyle = "rgba(42, 52, 57, 0.07)";
        context.lineWidth = 0.65;
        context.lineCap = "round";
        context.moveTo(p.trail[len - 1].x, p.trail[len - 1].y);
        context.lineTo(p.x, p.y);
        context.stroke();
      }
    }

    function tick() {
      agitation *= 0.93;
      var speedMultiplier = 1 + agitation * 0.4;

      var elapsed = performance.now() - startTime;
      if (elapsed > FORMATION_DELAY) {
        formationFactor = Math.min(1, formationFactor + 16 / FORMATION_RAMP);
      }

      var byId = new Map();
      particles.forEach(function (p) { byId.set(p.id, p); });

      var atoms = buildAtoms(particles, byId);
      attractFreeElectrons(particles, atoms, formationFactor);
      assignFreeElectrons(particles, atoms, formationFactor);
      applyLennardJones(particles, atoms, byId, formationFactor);
      applyAtomGravity(atoms, byId, formationFactor);
      applyPointerForces(particles, atoms, byId);
      updateElectrons(particles, atoms);

      particles.forEach(function (p) {
        if (p.role === "electron") return;
        if (p.breakCooldown > 0) p.breakCooldown--;

        p.driftAngle += DRIFT_ROT_SPEED * (0.7 + Math.random() * 0.6);
        p.vx += Math.cos(p.driftAngle) * DRIFT_FORCE;
        p.vy += Math.sin(p.driftAngle) * DRIFT_FORCE;

        p.vx *= VEL_DAMPING; p.vy *= VEL_DAMPING;
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      });

      ctx.clearRect(0, 0, width, height);
      drawNuclearBonds(ctx, atoms, byId);

      var renderOrder = particles.slice().sort(function (a, b) {
        var az = a.role === "electron" ? a.z : 0;
        var bz = b.role === "electron" ? b.z : 0;
        return az - bz;
      });
      renderOrder.forEach(function (p) {
        if (p.role === "electron" && p.hue !== "ciano" &&
            p.atomId !== null && ((atoms.get(p.atomId) || {}).nucleusIds || []).length >= 3) {
          drawTrail(ctx, p);
        }
      });
      renderOrder.forEach(function (p) { drawParticle(ctx, p); });

      rafId = requestAnimationFrame(tick);
    }

    function resize() {
      width = window.innerWidth; height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = width + "px"; canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      startTime = performance.now();
      formationFactor = 0;
      createParticles();
    }

    function onPointerMove(event) {
      pointer = { x: event.clientX, y: event.clientY, active: true };
    }
    function onPointerLeave() { pointer.active = false; }
    function onScroll() {
      agitation = Math.min(1, agitation + 0.35);
      if (scrollResetTimer) window.clearTimeout(scrollResetTimer);
      scrollResetTimer = window.setTimeout(function () { agitation = 0; }, 900);
    }

    resize();
    rafId = requestAnimationFrame(tick);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("pointerup", onPointerLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
