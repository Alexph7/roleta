(function () {
    // ========================================
    // ELEMENTOS
    // ========================================

    const telaHabilidade = document.getElementById("tela-habilidade");
    const tela = document.getElementById("tela-territorio");
    const botaoAbrir = document.getElementById("abrir-territorio");
    const botaoVoltar = document.getElementById("voltar-menu-territorio");

    const areaRegras = document.getElementById("territorio-regras");
    const areaJogo = document.getElementById("territorio-jogo");
    const placar = document.getElementById("territorio-placar");
    const placarArea = document.getElementById("territorio-placar-area");
    const placarElim = document.getElementById("territorio-placar-elim");
    const canvas = document.getElementById("territorio-canvas");
    const botaoComecar = document.getElementById("territorio-comecar");
    const textoRecorde = document.getElementById("territorio-recorde");
    const resultado = document.getElementById("resultado-territorio");
    const botaoDeNovo = document.getElementById("territorio-de-novo");

    if (
        !telaHabilidade || !tela || !botaoAbrir || !botaoVoltar ||
        !areaRegras || !areaJogo || !placar || !placarArea ||
        !placarElim || !canvas || !botaoComecar ||
        !textoRecorde || !resultado || !botaoDeNovo
    ) {
        console.error("Elementos do Territorio nao encontrados.");
        return;
    }

    const ctx = canvas.getContext("2d");
    const tg = window.Telegram?.WebApp;

    // ========================================
    // CONFIGURACOES (pode ajustar aqui)
    // ========================================

    const RAIO = 80;            // tamanho da arena
    const VISTA = 34;           // largura visivel da arena na tela (zoom)
    const VELOCIDADE = 8.5;     // velocidade de todos
    const GIRO_JOGADOR = 5.0;   // rapidez da curva do jogador (maior = curva mais fechada)
    const GIRO_BOT = 4.0;       // rapidez da curva dos bots
    const NUM_BOTS = 9;
    const VITORIA = 100;        // % da arena para vencer
    const RENASCER = 120;       // passos ate um bot voltar (60 passos = 1 segundo)

    // IDs do Telegram que podem jogar enquanto o card esta bloqueado.
    // Para liberar para todos: tire o bloqueio do card no index.html.
    const LIBERADO_PARA = [
        6294708048
    ];

    const PASSO = 1 / 60;       // o jogo calcula 60 vezes por segundo
    const S = 0.5;              // tamanho de cada "pedacinho" interno da arena
    const G = Math.ceil((RAIO * 2) / S) + 8;
    const C = (G * S) / 2;      // centro da arena

    // Cor 0 = jogador (roxo do app). Demais = bots (cores ja usadas no app).
    const CORES = [
        "#7c5cff", "#ff6b6b", "#06d6a0", "#4cc9f0", "#ffd166",
        "#f77f00", "#f72585", "#90be6d", "#2b9348", "#577590"
    ];
    const NOMES = [
        "Você", "Cometa", "Faísca", "Nuvem", "Trovão",
        "Lince", "Brisa", "Raio", "Pixel", "Orion"
    ];

    // ========================================
    // MAPA INTERNO
    // ========================================

    const valido = new Uint8Array(G * G);
    let totalValidas = 0;

    for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
            const dx = (i + 0.5) * S - C;
            const dy = (j + 0.5) * S - C;
            if (dx * dx + dy * dy <= RAIO * RAIO) {
                valido[j * G + i] = 1;
                totalValidas++;
            }
        }
    }

    let dono = new Uint8Array(G * G);
    let trilha = new Uint8Array(G * G);
    let carimbo = new Int32Array(G * G);

    let entidades = [];
    let jogador = null;

    let rodando = false;
    let pausado = false;
    let jogadorMorreu = false;
    let passos = 0;
    let maxPct = 0;
    let acumulado = 0;
    let ultimoQuadro = 0;

    // ========================================
    // AJUDANTES
    // ========================================

    function celula(x, y) {
        const i = Math.floor(x / S);
        const j = Math.floor(y / S);
        if (i < 0 || j < 0 || i >= G || j >= G) return -1;
        return j * G + i;
    }

    function naArena(x, y) {
        const dx = x - C;
        const dy = y - C;
        return dx * dx + dy * dy <= RAIO * RAIO;
    }

    function angulo(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    function aleatorio(min, max) {
        return min + Math.random() * (max - min);
    }

    function hexParaRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function misturar(hex, alvo, t) {
        const [r, g, b] = hexParaRgb(hex);
        const [r2, g2, b2] = alvo;
        return `rgb(${Math.round(r + (r2 - r) * t)}, ${Math.round(g + (g2 - g) * t)}, ${Math.round(b + (b2 - b) * t)})`;
    }

    // ========================================
    // CONTORNO SUAVE DAS AREAS
    // ========================================

    // Transforma os pedacinhos de uma area em um desenho com bordas
    // arredondadas (contorno + suavizacao).
    function construirContorno(e) {
        const id = e.id;
        const m = (i, j) => (i >= 0 && j >= 0 && i < G && j < G && dono[j * G + i] === id) ? 1 : 0;

        const adj = new Map();
        const chave = (X, Y) => (X + 4) * 10000 + (Y + 4);

        function ligar(a, b) {
            if (!adj.has(a)) adj.set(a, []);
            if (!adj.has(b)) adj.set(b, []);
            adj.get(a).push(b);
            adj.get(b).push(a);
        }

        let somaX = 0;
        let somaY = 0;
        let qtd = 0;

        for (let y = -1; y < G; y++) {
            for (let x = -1; x < G; x++) {
                const tl = m(x, y);
                const tr = m(x + 1, y);
                const br = m(x + 1, y + 1);
                const bl = m(x, y + 1);

                if (tl && x >= 0 && y >= 0) {
                    somaX += x;
                    somaY += y;
                    qtd++;
                }

                const caso = tl * 8 + tr * 4 + br * 2 + bl;
                if (caso === 0 || caso === 15) continue;

                const topo = chave(2 * x + 1, 2 * y);
                const dir = chave(2 * x + 2, 2 * y + 1);
                const baixo = chave(2 * x + 1, 2 * y + 2);
                const esq = chave(2 * x, 2 * y + 1);

                switch (caso) {
                    case 1: case 14: ligar(esq, baixo); break;
                    case 2: case 13: ligar(baixo, dir); break;
                    case 3: case 12: ligar(esq, dir); break;
                    case 4: case 11: ligar(topo, dir); break;
                    case 6: case 9: ligar(topo, baixo); break;
                    case 7: case 8: ligar(esq, topo); break;
                    case 5: ligar(esq, baixo); ligar(topo, dir); break;
                    case 10: ligar(esq, topo); ligar(baixo, dir); break;
                }
            }
        }

        e.casa = qtd ? { x: (somaX / qtd + 0.5) * S, y: (somaY / qtd + 0.5) * S } : null;

        if (adj.size === 0) {
            e.contorno = null;
            return;
        }

        const path = new Path2D();
        const visto = new Set();

        for (const inicio of adj.keys()) {
            if (visto.has(inicio)) continue;

            let pontos = [];
            let anterior = null;
            let atual = inicio;

            while (atual !== undefined && !visto.has(atual)) {
                visto.add(atual);
                const X = Math.floor(atual / 10000) - 4;
                const Y = (atual % 10000) - 4;
                pontos.push([(X / 2 + 0.5) * S, (Y / 2 + 0.5) * S]);

                const viz = adj.get(atual);
                const proximo = viz[0] !== anterior ? viz[0] : viz[1];
                anterior = atual;
                atual = proximo;
            }

            if (pontos.length < 3) continue;

            // Tira os "degraus": cada ponto vira a media com os vizinhos
            for (let r = 0; r < 10; r++) {
                const n = pontos.length;
                const novo = new Array(n);
                for (let k = 0; k < n; k++) {
                    const a = pontos[(k - 1 + n) % n];
                    const p = pontos[k];
                    const b = pontos[(k + 1) % n];
                    novo[k] = [
                        (a[0] + 2 * p[0] + b[0]) / 4,
                        (a[1] + 2 * p[1] + b[1]) / 4
                    ];
                }
                pontos = novo;
            }

            // Arredonda os cantos que sobraram
            for (let r = 0; r < 1; r++) {
                const novo = [];
                for (let k = 0; k < pontos.length; k++) {
                    const p = pontos[k];
                    const q = pontos[(k + 1) % pontos.length];
                    novo.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
                    novo.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
                }
                pontos = novo;
            }

            path.moveTo(pontos[0][0], pontos[0][1]);
            for (let k = 1; k < pontos.length; k++) path.lineTo(pontos[k][0], pontos[k][1]);
            path.closePath();
        }

        e.contorno = path;
    }

    function contarAreas() {
        const areas = new Array(entidades.length + 1).fill(0);
        for (let c = 0; c < dono.length; c++) {
            if (dono[c]) areas[dono[c]]++;
        }
        for (const e of entidades) e.area = areas[e.id];
    }

    // ========================================
    // NASCER, MORRER, CAPTURAR
    // ========================================

    function lugarLivre() {
        for (let t = 0; t < 300; t++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * (RAIO - 12);
            const x = C + Math.cos(a) * r;
            const y = C + Math.sin(a) * r;

            let livre = true;

            for (let dy = -7; dy <= 7 && livre; dy += 1) {
                for (let dx = -7; dx <= 7; dx += 1) {
                    const c = celula(x + dx, y + dy);
                    if (c < 0 || dono[c] !== 0 || trilha[c] !== 0) {
                        livre = false;
                        break;
                    }
                }
            }

            if (!livre) continue;

            for (const e of entidades) {
                if (e.vivo && Math.hypot(e.x - x, e.y - y) < 14) {
                    livre = false;
                    break;
                }
            }

            if (livre) return { x, y };
        }

        return null;
    }

    function nascer(e) {
        const lugar = lugarLivre();
        if (!lugar) return false;

        const raioBase = 3;

        for (let dy = -raioBase; dy <= raioBase; dy += S) {
            for (let dx = -raioBase; dx <= raioBase; dx += S) {
                if (dx * dx + dy * dy > raioBase * raioBase) continue;
                const c = celula(lugar.x + dx, lugar.y + dy);
                if (c >= 0 && valido[c]) dono[c] = e.id;
            }
        }

        e.x = e.px = lugar.x;
        e.y = e.py = lugar.y;
        e.ang = Math.atan2(C - lugar.y, C - lugar.x);
        e.alvo = e.ang;
        e.vivo = true;
        e.trilhaCel = [];
        e.trilhaPts = [];
        e.foraPassos = 0;
        e.modo = "casa";
        e.plano = [];
        e.espera = Math.floor(aleatorio(20, 90));
        e.casaPerto = null;

        construirContorno(e);
        return true;
    }

    function limparTrilha(e) {
        for (const c of e.trilhaCel) {
            if (trilha[c] === e.id) trilha[c] = 0;
        }
        e.trilhaCel = [];
        e.trilhaPts = [];
    }

    function matar(e, assassino) {
        if (!e.vivo) return;

        e.vivo = false;
        limparTrilha(e);

        for (let c = 0; c < dono.length; c++) {
            if (dono[c] === e.id) dono[c] = 0;
        }

        e.contorno = null;
        e.area = 0;

        if (assassino && assassino !== e) assassino.elim++;

        if (e.bot) e.renascer = RENASCER;
        else jogadorMorreu = true;
    }

    function capturar(e) {
        for (const c of e.trilhaCel) {
            if (trilha[c] === e.id) trilha[c] = 0;
            if (valido[c]) dono[c] = e.id;
        }
        e.trilhaCel = [];
        e.trilhaPts = [];

        // Tudo que nao da para alcancar "por fora" foi cercado
        const visto = new Uint8Array(G * G);
        const fila = new Int32Array(G * G);
        let ini = 0;
        let fim = 0;

        fila[fim++] = 0;
        visto[0] = 1;

        while (ini < fim) {
            const c = fila[ini++];
            const i = c % G;
            const j = (c - i) / G;

            if (i > 0) { const n = c - 1; if (!visto[n] && dono[n] !== e.id) { visto[n] = 1; fila[fim++] = n; } }
            if (i < G - 1) { const n = c + 1; if (!visto[n] && dono[n] !== e.id) { visto[n] = 1; fila[fim++] = n; } }
            if (j > 0) { const n = c - G; if (!visto[n] && dono[n] !== e.id) { visto[n] = 1; fila[fim++] = n; } }
            if (j < G - 1) { const n = c + G; if (!visto[n] && dono[n] !== e.id) { visto[n] = 1; fila[fim++] = n; } }
        }

        const afetados = new Set([e.id]);

        for (let c = 0; c < dono.length; c++) {
            if (valido[c] && !visto[c] && dono[c] !== e.id) {
                if (dono[c]) afetados.add(dono[c]);
                dono[c] = e.id;
            }
        }

        contarAreas();

        for (const id of afetados) {
            const o = entidades[id - 1];
            if (o !== e && o.vivo && o.area === 0) matar(o, e);
            else construirContorno(o);
        }

    }

    // ========================================
    // BOTS
    // ========================================

    function casaMaisPerto(b) {
        let melhor = null;
        let menor = Infinity;
        const bi = b.x / S;
        const bj = b.y / S;

        for (let c = 0; c < dono.length; c++) {
            if (dono[c] !== b.id) continue;
            const i = c % G;
            const j = (c - i) / G;
            const d = (i - bi) * (i - bi) + (j - bj) * (j - bj);
            if (d < menor) {
                menor = d;
                melhor = { x: (i + 0.5) * S, y: (j + 0.5) * S };
            }
        }

        return melhor;
    }

    function pensarBot(b) {
        const c = celula(b.x, b.y);
        const emCasa = c >= 0 && dono[c] === b.id;

        // Olha um pouco a frente
        const fx = b.x + Math.cos(b.ang) * 3;
        const fy = b.y + Math.sin(b.ang) * 3;
        const cf = celula(fx, fy);
        const bordaAFrente = !naArena(fx, fy) || Math.hypot(fx - C, fy - C) > RAIO - 1.5;
        const proprioRastroAFrente =
            cf >= 0 && trilha[cf] === b.id && passos - carimbo[cf] > 25;

        if (emCasa) {
            b.foraPassos = 0;

            if (b.modo === "voltar") {
                b.modo = "casa";
                b.espera = Math.floor(aleatorio(30, 120));
            }

            if (b.modo === "casa") {
                if (cf < 0 || dono[cf] !== b.id) {
                    if (b.casa) b.alvo = Math.atan2(b.casa.y - b.y, b.casa.x - b.x);
                } else {
                    b.alvo += aleatorio(-0.08, 0.08);
                }

                if (--b.espera <= 0) {
                    let base = Math.random() * Math.PI * 2;
                    if (Math.hypot(b.x - C, b.y - C) > RAIO - 14) {
                        base = Math.atan2(C - b.y, C - b.x) + aleatorio(-1, 1);
                    }
                    const lado = Math.random() < 0.5 ? 1 : -1;
                    b.plano = [
                        { ang: base, passos: Math.floor(aleatorio(60, 150)) },
                        { ang: base + lado * aleatorio(1.7, 2.4), passos: Math.floor(aleatorio(40, 110)) }
                    ];
                    b.modo = "sair";
                }
            }
        } else {
            b.foraPassos++;

            // Ataque: rastro de outro por perto, a frente
            for (const desvio of [0, -0.45, 0.45]) {
                let achou = false;
                for (let dist = 1; dist <= 5; dist++) {
                    const ca = celula(
                        b.x + Math.cos(b.ang + desvio) * dist,
                        b.y + Math.sin(b.ang + desvio) * dist
                    );
                    if (ca >= 0 && trilha[ca] && trilha[ca] !== b.id) {
                        b.alvo = b.ang + desvio;
                        achou = true;
                        break;
                    }
                }
                if (achou) return;
            }

            // Perigo: alguem perto, rastro longo, ou rumo ruim
            let perigo = b.foraPassos > 420 || bordaAFrente || proprioRastroAFrente;
            for (const o of entidades) {
                if (o !== b && o.vivo && Math.hypot(o.x - b.x, o.y - b.y) < 7) perigo = true;
            }
            if (perigo) b.modo = "voltar";
        }

        if (b.modo === "sair") {
            const p = b.plano[0];
            if (p) {
                b.alvo = p.ang;
                if (--p.passos <= 0) b.plano.shift();
            } else {
                b.modo = "voltar";
            }
        }

        if (b.modo === "voltar" && !emCasa) {
            if (!b.casaPerto || passos % 15 === 0) b.casaPerto = casaMaisPerto(b);
            if (b.casaPerto) b.alvo = Math.atan2(b.casaPerto.y - b.y, b.casaPerto.x - b.x);
            if (proprioRastroAFrente) b.alvo = b.ang + Math.PI / 2;
        }

        if (bordaAFrente) b.alvo = Math.atan2(C - b.y, C - b.x);
    }

    // ========================================
    // UM PASSO DO JOGO
    // ========================================

    function passo() {
        passos++;

        for (const e of entidades) {
            if (e.bot && !e.vivo) {
                if (e.renascer > 0) e.renascer--;
                else if (!nascer(e)) e.renascer = 60;
            }
        }

        const vivos = entidades.filter(e => e.vivo);

        // Vira suavemente e anda
        for (const e of vivos) {
            e.px = e.x;
            e.py = e.y;

            if (e.bot) pensarBot(e);
            else if (controle.alvo !== null) e.alvo = controle.alvo;

            const giro = (e.bot ? GIRO_BOT : GIRO_JOGADOR) * PASSO;
            const diff = angulo(e.alvo - e.ang);
            e.ang = angulo(e.ang + Math.max(-giro, Math.min(giro, diff)));

            e.x += Math.cos(e.ang) * VELOCIDADE * PASSO;
            e.y += Math.sin(e.ang) * VELOCIDADE * PASSO;
        }

        const mortes = new Map();
        const marcar = (v, a) => { if (!mortes.has(v)) mortes.set(v, a); };

        for (const e of vivos) {
            if (!naArena(e.x, e.y)) marcar(e, null);
        }

        // Batida de cabeca
        for (let i = 0; i < vivos.length; i++) {
            for (let j = i + 1; j < vivos.length; j++) {
                const a = vivos[i];
                const b = vivos[j];
                if (Math.hypot(a.x - b.x, a.y - b.y) > 0.9) continue;

                const ca = celula(a.x, a.y);
                const cb = celula(b.x, b.y);
                const aCasa = ca >= 0 && dono[ca] === a.id;
                const bCasa = cb >= 0 && dono[cb] === b.id;

                if (aCasa && !bCasa) marcar(b, a);
                else if (bCasa && !aCasa) marcar(a, b);
                else { marcar(a, b); marcar(b, a); }
            }
        }

        // Rastros
        for (const e of vivos) {
            if (mortes.has(e)) continue;
            const c = celula(e.x, e.y);
            if (c < 0) continue;
            const t = trilha[c];
            if (!t) continue;

            if (t === e.id) {
                if (passos - carimbo[c] > 25) marcar(e, null);
            } else {
                const vitima = entidades[t - 1];
                if (vitima.vivo) marcar(vitima, e);
            }
        }

        for (const [v, a] of mortes) matar(v, a);

        // Deixa rastro ou fecha a area
        for (const e of vivos) {
            if (!e.vivo) continue;

            const c = celula(e.x, e.y);
            if (c < 0) continue;

            if (dono[c] === e.id) {
                if (e.trilhaCel.length) capturar(e);
                continue;
            }

            if (e.trilhaPts.length === 0) e.trilhaPts.push([e.px, e.py]);

            for (const [ox, oy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
                const cc = celula(e.x + ox, e.y + oy);
                if (cc < 0 || !valido[cc] || dono[cc] === e.id) continue;
                if (trilha[cc] && trilha[cc] !== e.id) continue;
                if (trilha[cc] === e.id) continue;
                e.trilhaCel.push(cc);
                trilha[cc] = e.id;
                carimbo[cc] = passos;
            }

            const ultimo = e.trilhaPts[e.trilhaPts.length - 1];
            if (Math.hypot(ultimo[0] - e.x, ultimo[1] - e.y) > 0.3) {
                e.trilhaPts.push([e.x, e.y]);
            }
        }

        // Placar
        const pct = jogador.vivo ? (jogador.area / totalValidas) * 100 : 0;
        if (pct > maxPct) maxPct = pct;

        if (passos % 6 === 0) {
            placarArea.textContent = `${pct.toFixed(1)}%`;
            placarElim.textContent = jogador.elim;
        }

        if (jogadorMorreu) terminar(false);
        else if (pct >= VITORIA) terminar(true);
    }

    // ========================================
    // DESENHO
    // ========================================

    function formatarTempo(ms) {
        const total = Math.floor(ms / 1000);
        const min = String(Math.floor(total / 60)).padStart(2, "0");
        const seg = String(total % 60).padStart(2, "0");
        return `${min}:${seg}`;
    }

    function dimensionar() {
        const dpr = window.devicePixelRatio || 1;
        const largura = Math.min(window.innerWidth - 8, 480);
        const altura = Math.max(
            260,
            Math.min(Math.round(largura * 1.9), window.innerHeight - 90)
        );

        canvas.style.width = `${largura}px`;
        canvas.style.height = `${altura}px`;
        canvas.width = Math.round(largura * dpr);
        canvas.height = Math.round(altura * dpr);
    }

    function desenhar(alfa) {
        const W = canvas.width;
        const H = canvas.height;
        const dpr = window.devicePixelRatio || 1;
        const esc = W / VISTA;

        const camX = jogador.px + (jogador.x - jogador.px) * alfa;
        const camY = jogador.py + (jogador.y - jogador.py) * alfa;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#090811";
        ctx.fillRect(0, 0, W, H);

        ctx.setTransform(esc, 0, 0, esc, W / 2 - camX * esc, H / 2 - camY * esc);

        // Chao da arena
        ctx.beginPath();
        ctx.arc(C, C, RAIO, 0, Math.PI * 2);
        ctx.fillStyle = "#f4f2fb";
        ctx.fill();

        // Textura leve (da sensacao de movimento)
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(21,18,41,0.05)";
        ctx.lineWidth = 0.06;
        const meiaL = VISTA / 2 + 2;
        const meiaA = (H / esc) / 2 + 2;
        ctx.beginPath();
        for (let x = Math.floor((camX - meiaL) / 2) * 2; x <= camX + meiaL; x += 2) {
            ctx.moveTo(x, camY - meiaA);
            ctx.lineTo(x, camY + meiaA);
        }
        for (let y = Math.floor((camY - meiaA) / 2) * 2; y <= camY + meiaA; y += 2) {
            ctx.moveTo(camX - meiaL, y);
            ctx.lineTo(camX + meiaL, y);
        }
        ctx.stroke();
        ctx.restore();

        // Areas (sombra + cor)
        for (const e of entidades) {
            if (!e.contorno) continue;
            ctx.save();
            ctx.translate(0, 0.35);
            ctx.fillStyle = e.corEscura;
            ctx.fill(e.contorno, "evenodd");
            ctx.restore();
            ctx.fillStyle = e.cor;
            ctx.fill(e.contorno, "evenodd");
        }

        // Rastros
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const e of entidades) {
            if (!e.vivo || e.trilhaPts.length === 0) continue;
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = e.corClara;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(e.trilhaPts[0][0], e.trilhaPts[0][1]);
            for (let k = 1; k < e.trilhaPts.length; k++) {
                ctx.lineTo(e.trilhaPts[k][0], e.trilhaPts[k][1]);
            }
            ctx.lineTo(
                e.px + (e.x - e.px) * alfa,
                e.py + (e.y - e.py) * alfa
            );
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Borda da arena
        ctx.beginPath();
        ctx.arc(C, C, RAIO, 0, Math.PI * 2);
        ctx.strokeStyle = "#8c78ff";
        ctx.lineWidth = 0.3;
        ctx.stroke();

        // Cabecas e nomes
        for (const e of entidades) {
            if (!e.vivo && e !== jogador) continue;

            const hx = e.px + (e.x - e.px) * alfa;
            const hy = e.py + (e.y - e.py) * alfa;

            ctx.save();
            ctx.translate(hx, hy);
            ctx.globalAlpha = e.vivo ? 1 : 0.35;

            ctx.save();
            ctx.rotate(e.ang);
            ctx.fillStyle = e.corEscura;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-0.65, -0.65 + 0.2, 1.3, 1.3, 0.3);
            else ctx.rect(-0.65, -0.45, 1.3, 1.3);
            ctx.fill();
            ctx.fillStyle = e.corClara;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-0.65, -0.65, 1.3, 1.3, 0.3);
            else ctx.rect(-0.65, -0.65, 1.3, 1.3);
            ctx.fill();
            if (!e.bot) {
                ctx.strokeStyle = "#ffd166";
                ctx.lineWidth = 0.15;
                ctx.stroke();
            }
            ctx.restore();

            ctx.font = "bold 0.75px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.lineWidth = 0.18;
            ctx.strokeStyle = "rgba(21,18,41,0.75)";
            ctx.strokeText(e.nome, 0, -1.1);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(e.nome, 0, -1.1);

            ctx.restore();
        }

        ctx.globalAlpha = 1;

    }

    // ========================================
    // LACO DO JOGO
    // ========================================

    function quadro(agora) {
        if (!rodando) return;

        if (pausado) {
            ultimoQuadro = agora;
            requestAnimationFrame(quadro);
            return;
        }

        acumulado += (agora - ultimoQuadro) / 1000;
        ultimoQuadro = agora;

        if (acumulado > 0.25) acumulado = PASSO;

        while (acumulado >= PASSO && rodando) {
            passo();
            acumulado -= PASSO;
        }

        desenhar(rodando ? acumulado / PASSO : 1);

        if (rodando) requestAnimationFrame(quadro);
    }

    // ========================================
    // RECORDE
    // ========================================

    function lerRecorde() {
        try {
            return Number(localStorage.getItem("territorio-recorde") || 0);
        } catch (e) {
            return 0;
        }
    }

    function salvarRecorde(valor) {
        try {
            localStorage.setItem("territorio-recorde", String(valor));
        } catch (e) { }
    }

    function mostrarRecorde() {
        const r = lerRecorde();
        textoRecorde.textContent = r > 0 ? `Seu recorde: ${r.toFixed(1)}% da arena` : "";
    }

    // ========================================
    // INICIO E FIM
    // ========================================

    function travarArrasto(travar) {
        try {
            if (travar) tg?.disableVerticalSwipes?.();
            else tg?.enableVerticalSwipes?.();
        } catch (e) { }
    }

    function comecar() {
        dono = new Uint8Array(G * G);
        trilha = new Uint8Array(G * G);
        carimbo = new Int32Array(G * G);
        entidades = [];

        for (let i = 0; i <= NUM_BOTS; i++) {
            const cor = CORES[i % CORES.length];
            entidades.push({
                id: i + 1,
                bot: i > 0,
                nome: NOMES[i % NOMES.length],
                cor,
                corEscura: misturar(cor, [0, 0, 0], 0.35),
                corClara: misturar(cor, [255, 255, 255], 0.25),
                vivo: false,
                x: 0, y: 0, px: 0, py: 0,
                ang: 0, alvo: 0,
                trilhaCel: [], trilhaPts: [],
                foraPassos: 0,
                modo: "casa", plano: [], espera: 0,
                casa: null, casaPerto: null,
                contorno: null,
                renascer: 0, elim: 0, area: 0
            });
        }

        jogador = entidades[0];

        for (const e of entidades) nascer(e);
        contarAreas();

        controle.alvo = null;
        controle.origem = null;
        passos = 0;
        maxPct = 0;
        jogadorMorreu = false;
        acumulado = 0;
        pausado = false;

        placarArea.textContent = "0%";
        placarElim.textContent = "0";

        areaRegras.hidden = true;
        areaJogo.hidden = false;
        placar.hidden = false;
        botaoDeNovo.hidden = true;
        resultado.textContent = "";

        dimensionar();
        travarArrasto(true);

        rodando = true;
        ultimoQuadro = performance.now();
        requestAnimationFrame(quadro);
    }

    function terminar(venceu) {
        rodando = false;
        travarArrasto(false);
        desenhar(1);

        const recordeAntes = lerRecorde();
        if (maxPct > recordeAntes) salvarRecorde(maxPct);

        const elim = jogador.elim;
        const textoElim = `${elim} ${elim === 1 ? "eliminação" : "eliminações"}`;

        if (venceu) {
            resultado.textContent = `🏆 Você preencheu o círculo com ${textoElim}!`;
        } else {
            resultado.textContent =
                `Fim! Maior área: ${maxPct.toFixed(1)}% · ${textoElim}` +
                (maxPct > recordeAntes && recordeAntes > 0 ? " · Novo recorde!" : "");
        }

        botaoDeNovo.hidden = false;
    }

    function mostrarRegras() {
        rodando = false;
        travarArrasto(false);
        areaRegras.hidden = false;
        areaJogo.hidden = true;
        placar.hidden = true;
        botaoDeNovo.hidden = true;
        resultado.textContent = "";
        mostrarRecorde();
    }

    // ========================================
    // CONTROLES
    // ========================================

    // Controle: o personagem vira para o lado onde o dedo esta,
    // em relacao a ele (ele fica sempre no centro da arena).
    // Igual ao mouse no PC. A curva continua suave.
    const controle = { alvo: null, origem: null };

    function apontarPara(x, y) {
        const r = canvas.getBoundingClientRect();
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) > 10) controle.alvo = Math.atan2(dy, dx);
    }

    areaJogo.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        apontarPara(t.clientX, t.clientY);
        e.preventDefault();
    }, { passive: false });

    areaJogo.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        apontarPara(t.clientX, t.clientY);
        e.preventDefault();
    }, { passive: false });

    // PC: o personagem segue o mouse (para testar no VS Code)
    canvas.addEventListener("mousemove", (e) => {
        if (!rodando) return;
        const r = canvas.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) > 4) controle.alvo = Math.atan2(dy, dx);
    });

    // PC: setas ou W A S D tambem funcionam
    const teclas = new Set();

    function direcaoTeclado() {
        let dx = 0;
        let dy = 0;
        if (teclas.has("up")) dy -= 1;
        if (teclas.has("down")) dy += 1;
        if (teclas.has("left")) dx -= 1;
        if (teclas.has("right")) dx += 1;
        if (dx || dy) controle.alvo = Math.atan2(dy, dx);
    }

    const mapaTeclas = {
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right"
    };

    document.addEventListener("keydown", (e) => {
        if (tela.hidden || !rodando || !(e.key in mapaTeclas)) return;
        teclas.add(mapaTeclas[e.key]);
        direcaoTeclado();
        e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
        if (e.key in mapaTeclas) teclas.delete(mapaTeclas[e.key]);
    });

    // ========================================
    // TELAS
    // ========================================

    // Libera o card so para os IDs acima (e no PC, rodando local, para testes)
    const meuId = Number(tg?.initDataUnsafe?.user?.id || 0);
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);

    if (botaoAbrir.disabled && (LIBERADO_PARA.includes(meuId) || local)) {
        botaoAbrir.disabled = false;
        botaoAbrir.classList.remove("card-bloqueado");
        const aviso = botaoAbrir.querySelector("small");
        if (aviso) aviso.textContent = "SÓ VOCÊ VÊ";
    }

    botaoAbrir.addEventListener("click", () => {
        document.querySelectorAll("main > .tela").forEach(t => {
            t.hidden = true;
        });
        tela.hidden = false;
        mostrarRegras();
    });

    botaoVoltar.addEventListener("click", () => {
        rodando = false;
        travarArrasto(false);
        tela.hidden = true;
        telaHabilidade.hidden = false;
    });

    botaoComecar.addEventListener("click", comecar);
    botaoDeNovo.addEventListener("click", comecar);

    document.addEventListener("visibilitychange", () => {
        pausado = document.hidden;
    });

    window.addEventListener("resize", () => {
        if (rodando) dimensionar();
    });
})();
