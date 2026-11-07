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
    const placarTempo = document.getElementById("territorio-placar-tempo");
    const canvas = document.getElementById("territorio-canvas");
    const botaoComecar = document.getElementById("territorio-comecar");
    const textoRecorde = document.getElementById("territorio-recorde");
    const resultado = document.getElementById("resultado-territorio");
    const botaoDeNovo = document.getElementById("territorio-de-novo");

    if (
        !telaHabilidade || !tela || !botaoAbrir || !botaoVoltar ||
        !areaRegras || !areaJogo || !placar || !placarArea ||
        !placarElim || !placarTempo || !canvas || !botaoComecar ||
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

    const RAIO = 34;          // tamanho da arena (raio em casas)
    const TICK = 110;         // ms por passo (menor = mais rapido)
    const VISTA = 24;         // quantas casas aparecem na largura da tela
    const NUM_BOTS = 5;       // quantos bots na arena
    const VITORIA = 100;      // % da arena para vencer
    const RENASCER = 18;      // passos ate um bot voltar depois de morrer

    // Cor 0 = jogador (roxo do app). Demais = bots (cores ja usadas no app).
    const CORES = ["#7c5cff", "#ff6b6b", "#06d6a0", "#4cc9f0", "#ffd166", "#f77f00"];

    // 0 = cima, 1 = direita, 2 = baixo, 3 = esquerda
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    const N = RAIO * 2 + 5;
    const CENTRO = Math.floor(N / 2);

    // Casas que fazem parte do circulo
    const valido = new Uint8Array(N * N);
    let totalValidas = 0;

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const dx = x - CENTRO;
            const dy = y - CENTRO;
            if (dx * dx + dy * dy <= RAIO * RAIO) {
                valido[y * N + x] = 1;
                totalValidas++;
            }
        }
    }

    // ========================================
    // ESTADO
    // ========================================

    let dono = new Uint8Array(N * N);    // quem e dono de cada casa (0 = ninguem)
    let trilha = new Uint8Array(N * N);  // rastro de quem passa em cada casa
    let entidades = [];
    let jogador = null;
    let fila = [];

    let rodando = false;
    let pausado = false;
    let jogadorMorreu = false;
    let passos = 0;
    let maxPct = 0;
    let acumulado = 0;
    let ultimoQuadro = 0;

    // ========================================
    // FUNCOES DA ARENA
    // ========================================

    function idx(x, y) {
        return y * N + x;
    }

    function dentro(x, y) {
        return x >= 0 && y >= 0 && x < N && y < N && valido[idx(x, y)] === 1;
    }

    function aleatorio(n) {
        return Math.floor(Math.random() * n);
    }

    function entidadePorId(id) {
        return entidades[id - 1];
    }

    function lugarLivre() {
        for (let t = 0; t < 400; t++) {
            const x = CENTRO - RAIO + 5 + aleatorio(RAIO * 2 - 9);
            const y = CENTRO - RAIO + 5 + aleatorio(RAIO * 2 - 9);
            if (!dentro(x, y)) continue;

            let livre = true;

            for (let dy = -4; dy <= 4 && livre; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (!dentro(nx, ny)) { livre = false; break; }
                    const c = idx(nx, ny);
                    if (dono[c] !== 0 || trilha[c] !== 0) { livre = false; break; }
                }
            }

            if (!livre) continue;

            for (const e of entidades) {
                if (e.vivo && Math.abs(e.x - x) + Math.abs(e.y - y) < 8) {
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

        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (dx * dx + dy * dy <= 5) {
                    dono[idx(lugar.x + dx, lugar.y + dy)] = e.id;
                }
            }
        }

        e.x = e.px = lugar.x;
        e.y = e.py = lugar.y;
        e.vivo = true;
        e.trilha = [];
        e.plano = [];
        e.espera = 3 + aleatorio(15);

        // Comeca andando para o lado do centro
        const dx = CENTRO - lugar.x;
        const dy = CENTRO - lugar.y;
        if (Math.abs(dx) > Math.abs(dy)) e.dir = dx > 0 ? 1 : 3;
        else e.dir = dy > 0 ? 2 : 0;

        return true;
    }

    function matar(e, assassino) {
        if (!e.vivo) return;

        e.vivo = false;

        for (const c of e.trilha) {
            if (trilha[c] === e.id) trilha[c] = 0;
        }
        e.trilha = [];

        for (let c = 0; c < dono.length; c++) {
            if (dono[c] === e.id) dono[c] = 0;
        }

        if (assassino && assassino !== e) assassino.elim++;

        if (e.bot) {
            e.renascer = RENASCER;
        } else {
            jogadorMorreu = true;
        }
    }

    // Fecha o caminho: o rastro e tudo que ficou dentro vira do jogador
    function capturar(e) {
        for (const c of e.trilha) {
            if (trilha[c] === e.id) trilha[c] = 0;
            dono[c] = e.id;
        }
        e.trilha = [];

        // Tudo que da para alcancar "por fora" (sem passar pela area de e)
        // continua como esta. O resto foi cercado.
        const visto = new Uint8Array(N * N);
        const fila2 = new Int32Array(N * N);
        let ini = 0;
        let fim = 0;

        fila2[fim++] = 0;
        visto[0] = 1;

        while (ini < fim) {
            const c = fila2[ini++];
            const x = c % N;
            const y = (c - x) / N;

            for (const d of DIRS) {
                const nx = x + d[0];
                const ny = y + d[1];
                if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
                const nc = idx(nx, ny);
                if (visto[nc] || dono[nc] === e.id) continue;
                visto[nc] = 1;
                fila2[fim++] = nc;
            }
        }

        for (let c = 0; c < dono.length; c++) {
            if (valido[c] && !visto[c] && dono[c] !== e.id) {
                dono[c] = e.id;
            }
        }
    }

    function contarAreas() {
        const areas = new Array(entidades.length + 1).fill(0);
        for (let c = 0; c < dono.length; c++) {
            if (dono[c]) areas[dono[c]]++;
        }
        for (const e of entidades) e.area = areas[e.id];
    }

    // ========================================
    // BOTS
    // ========================================

    function casaMaisPerto(b) {
        let melhor = null;
        let menor = Infinity;

        for (let c = 0; c < dono.length; c++) {
            if (dono[c] !== b.id) continue;
            const x = c % N;
            const y = (c - x) / N;
            const dist = Math.abs(x - b.x) + Math.abs(y - b.y);
            if (dist < menor) {
                menor = dist;
                melhor = { x, y };
            }
        }

        return melhor;
    }

    function pensarBot(b) {
        const reverso = (b.dir + 2) % 4;
        const emCasa = dono[idx(b.x, b.y)] === b.id;

        function seguro(d) {
            if (d === reverso) return false;
            const nx = b.x + DIRS[d][0];
            const ny = b.y + DIRS[d][1];
            if (!dentro(nx, ny)) return false;
            return trilha[idx(nx, ny)] !== b.id;
        }

        function rumoCasa() {
            const alvo = casaMaisPerto(b);
            if (!alvo) return b.dir;

            let melhor = -1;
            let menor = Infinity;

            for (let d = 0; d < 4; d++) {
                if (!seguro(d)) continue;
                const nx = b.x + DIRS[d][0];
                const ny = b.y + DIRS[d][1];
                const dist = Math.abs(nx - alvo.x) + Math.abs(ny - alvo.y);
                if (dist < menor) {
                    menor = dist;
                    melhor = d;
                }
            }

            return melhor >= 0 ? melhor : b.dir;
        }

        // Ataque: se puder pisar no rastro de alguem, pisa
        for (let d = 0; d < 4; d++) {
            if (!seguro(d)) continue;
            const t = trilha[idx(b.x + DIRS[d][0], b.y + DIRS[d][1])];
            if (t && t !== b.id) {
                b.dir = d;
                return;
            }
        }

        // Perigo: alguem perto enquanto esta fora de casa -> volta
        if (!emCasa && b.trilha.length > 0) {
            for (const o of entidades) {
                if (o === b || !o.vivo) continue;
                if (Math.abs(o.x - b.x) + Math.abs(o.y - b.y) <= 4) {
                    b.plano = [];
                    break;
                }
            }
        }

        if (b.trilha.length > 40) b.plano = [];

        // Em casa e sem plano: espera um pouco e cria um novo passeio
        if (emCasa && b.plano.length === 0) {
            if (b.espera > 0) {
                b.espera--;
            } else {
                const lado = Math.random() < 0.5 ? 1 : 3;
                const d1 = b.dir;
                const d2 = (d1 + lado) % 4;
                const d3 = (d2 + lado) % 4;
                const ida = 3 + aleatorio(8);
                const largura = 3 + aleatorio(8);

                b.plano = [
                    { d: d1, n: ida },
                    { d: d2, n: largura },
                    { d: d3, n: ida }
                ];
                b.espera = 5 + aleatorio(20);
            }
        }

        let desejada = b.dir;

        if (b.plano.length > 0) {
            const p = b.plano[0];
            desejada = p.d;
            p.n--;
            if (p.n <= 0) b.plano.shift();
        } else if (!emCasa) {
            desejada = rumoCasa();
        } else {
            // Passeia dentro da propria area
            const nx = b.x + DIRS[b.dir][0];
            const ny = b.y + DIRS[b.dir][1];
            if (!dentro(nx, ny) || dono[idx(nx, ny)] !== b.id) {
                const opcoes = [];
                for (let d = 0; d < 4; d++) {
                    if (!seguro(d)) continue;
                    const cx = b.x + DIRS[d][0];
                    const cy = b.y + DIRS[d][1];
                    if (dono[idx(cx, cy)] === b.id) opcoes.push(d);
                }
                if (opcoes.length) desejada = opcoes[aleatorio(opcoes.length)];
            }
        }

        if (!seguro(desejada)) {
            if (!emCasa) {
                desejada = rumoCasa();
            } else {
                const opcoes = [];
                for (let d = 0; d < 4; d++) if (seguro(d)) opcoes.push(d);
                if (opcoes.length) desejada = opcoes[aleatorio(opcoes.length)];
            }
            b.plano = [];
        }

        b.dir = desejada;
    }

    // ========================================
    // UM PASSO DO JOGO
    // ========================================

    function aplicarFila() {
        while (fila.length) {
            const d = fila.shift();
            if (d !== jogador.dir && d !== (jogador.dir + 2) % 4) {
                jogador.dir = d;
                break;
            }
        }
    }

    function passo() {
        passos++;

        // Bots que morreram voltam depois de um tempo
        for (const e of entidades) {
            if (e.bot && !e.vivo) {
                if (e.renascer > 0) e.renascer--;
                else if (!nascer(e)) e.renascer = 10;
            }
        }

        const vivos = entidades.filter(e => e.vivo);

        // Decide a direcao
        for (const e of vivos) {
            e.px = e.x;
            e.py = e.y;
            if (e.bot) pensarBot(e);
            else aplicarFila();
            e.nx = e.x + DIRS[e.dir][0];
            e.ny = e.y + DIRS[e.dir][1];
        }

        const mortes = new Map();

        function marcar(vitima, assassino) {
            if (!mortes.has(vitima)) mortes.set(vitima, assassino);
        }

        // Saiu do circulo
        for (const e of vivos) {
            if (!dentro(e.nx, e.ny)) marcar(e, null);
        }

        // Batida de cabeca
        for (let i = 0; i < vivos.length; i++) {
            for (let j = i + 1; j < vivos.length; j++) {
                const a = vivos[i];
                const b = vivos[j];

                const mesmaCasa = a.nx === b.nx && a.ny === b.ny;
                const cruzaram =
                    a.nx === b.x && a.ny === b.y &&
                    b.nx === a.x && b.ny === a.y;

                if (!mesmaCasa && !cruzaram) continue;

                const c = dentro(a.nx, a.ny) ? idx(a.nx, a.ny) : -1;
                const aCasa = c >= 0 && dono[c] === a.id;
                const bCasa = c >= 0 && dono[c] === b.id;

                if (mesmaCasa && aCasa && !bCasa) marcar(b, a);
                else if (mesmaCasa && bCasa && !aCasa) marcar(a, b);
                else {
                    marcar(a, b);
                    marcar(b, a);
                }
            }
        }

        // Rastros
        for (const e of vivos) {
            if (mortes.has(e)) continue;
            const t = trilha[idx(e.nx, e.ny)];
            if (t === 0) continue;

            if (t === e.id) {
                marcar(e, null);
            } else {
                const vitima = entidadePorId(t);
                if (vitima && vitima.vivo) marcar(vitima, e);
            }
        }

        for (const [vitima, assassino] of mortes) {
            matar(vitima, assassino);
        }

        // Anda
        const capturas = [];

        for (const e of vivos) {
            if (!e.vivo) continue;

            e.x = e.nx;
            e.y = e.ny;

            const c = idx(e.x, e.y);

            if (dono[c] === e.id) {
                if (e.trilha.length) capturas.push(e);
            } else {
                trilha[c] = e.id;
                e.trilha.push(c);
            }
        }

        for (const e of capturas) {
            if (!e.vivo) continue;
            capturar(e);
            contarAreas();

            // Quem ficou sem area nenhuma foi eliminado por quem cercou
            for (const o of entidades) {
                if (o !== e && o.vivo && o.area === 0) matar(o, e);
            }
        }

        contarAreas();

        // Placar
        const pct = jogador.vivo ? (jogador.area / totalValidas) * 100 : 0;
        if (pct > maxPct) maxPct = pct;

        placarArea.textContent = `${pct.toFixed(1)}%`;
        placarElim.textContent = jogador.elim;
        placarTempo.textContent = formatarTempo(passos * TICK);

        if (jogadorMorreu) {
            terminar(false);
        } else if (pct >= VITORIA) {
            terminar(true);
        }
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
            Math.min(Math.round(largura * 1.2), window.innerHeight - 150)
        );

        canvas.style.width = `${largura}px`;
        canvas.style.height = `${altura}px`;
        canvas.width = Math.round(largura * dpr);
        canvas.height = Math.round(altura * dpr);
    }

    function desenhar(alfa) {
        const W = canvas.width;
        const H = canvas.height;
        const cel = W / VISTA;

        const foco = jogador;
        const cx = foco.px + (foco.x - foco.px) * alfa + 0.5;
        const cy = foco.py + (foco.y - foco.py) * alfa + 0.5;

        const x0 = cx - W / 2 / cel;
        const y0 = cy - H / 2 / cel;

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#090811";
        ctx.fillRect(0, 0, W, H);

        const xi = Math.max(0, Math.floor(x0));
        const xf = Math.min(N - 1, Math.ceil(x0 + W / cel));
        const yi = Math.max(0, Math.floor(y0));
        const yf = Math.min(N - 1, Math.ceil(y0 + H / cel));

        const gap = Math.max(1, cel * 0.06);

        for (let y = yi; y <= yf; y++) {
            for (let x = xi; x <= xf; x++) {
                const c = idx(x, y);
                if (!valido[c]) continue;

                const sx = (x - x0) * cel;
                const sy = (y - y0) * cel;

                const d = dono[c];
                const t = trilha[c];

                if (d) {
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = CORES[d - 1];
                    ctx.fillRect(sx, sy, cel + 0.5, cel + 0.5);
                } else {
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = "#1b1730";
                    ctx.fillRect(sx + gap / 2, sy + gap / 2, cel - gap, cel - gap);
                }

                if (t) {
                    ctx.globalAlpha = 0.45;
                    ctx.fillStyle = CORES[t - 1];
                    ctx.fillRect(sx + cel * 0.15, sy + cel * 0.15, cel * 0.7, cel * 0.7);
                }
            }
        }

        ctx.globalAlpha = 1;

        // Borda do circulo
        ctx.beginPath();
        ctx.arc(
            (CENTRO + 0.5 - x0) * cel,
            (CENTRO + 0.5 - y0) * cel,
            (RAIO + 0.5) * cel,
            0,
            Math.PI * 2
        );
        ctx.strokeStyle = "#8c78ff";
        ctx.lineWidth = Math.max(2, cel * 0.12);
        ctx.stroke();

        // Cabecas
        for (const e of entidades) {
            if (!e.vivo && e !== jogador) continue;

            const hx = (e.px + (e.x - e.px) * alfa - x0) * cel;
            const hy = (e.py + (e.y - e.py) * alfa - y0) * cel;
            const m = cel * 0.06;
            const tam = cel - m * 2;

            ctx.globalAlpha = e.vivo ? 1 : 0.4;
            ctx.fillStyle = e.cor;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(hx + m, hy + m, tam, tam, cel * 0.22);
            else ctx.rect(hx + m, hy + m, tam, tam);
            ctx.fill();

            ctx.lineWidth = Math.max(1.5, cel * 0.1);
            ctx.strokeStyle = e.bot ? "rgba(255,255,255,0.85)" : "#ffd166";
            ctx.stroke();

            // Olhinhos na direcao em que anda
            const ox = DIRS[e.dir][0] * cel * 0.14;
            const oy = DIRS[e.dir][1] * cel * 0.14;
            ctx.fillStyle = "#151229";
            for (const lado of [-1, 1]) {
                const px = DIRS[e.dir][1] * lado * cel * 0.16;
                const py = DIRS[e.dir][0] * lado * cel * 0.16;
                ctx.beginPath();
                ctx.arc(hx + cel / 2 + ox + px, hy + cel / 2 + oy + py, cel * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }
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

        acumulado += agora - ultimoQuadro;
        ultimoQuadro = agora;

        if (acumulado > 1000) acumulado = TICK;

        while (acumulado >= TICK && rodando) {
            passo();
            acumulado -= TICK;
        }

        desenhar(rodando ? acumulado / TICK : 1);

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
        dono = new Uint8Array(N * N);
        trilha = new Uint8Array(N * N);
        entidades = [];
        fila = [];

        for (let i = 0; i <= NUM_BOTS; i++) {
            entidades.push({
                id: i + 1,
                bot: i > 0,
                cor: CORES[i % CORES.length],
                vivo: false,
                x: 0, y: 0, px: 0, py: 0, nx: 0, ny: 0,
                dir: 0,
                trilha: [],
                plano: [],
                espera: 0,
                renascer: 0,
                elim: 0,
                area: 0
            });
        }

        jogador = entidades[0];

        for (const e of entidades) nascer(e);
        contarAreas();

        passos = 0;
        maxPct = 0;
        jogadorMorreu = false;
        acumulado = 0;
        pausado = false;

        placarArea.textContent = "0%";
        placarElim.textContent = "0";
        placarTempo.textContent = "00:00";

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

        const tempo = formatarTempo(passos * TICK);
        const elim = jogador.elim;
        const textoElim = `${elim} ${elim === 1 ? "eliminação" : "eliminações"}`;

        if (venceu) {
            resultado.textContent = `🏆 Você preencheu o círculo em ${tempo} com ${textoElim}!`;
        } else {
            resultado.textContent =
                `Fim! Maior área: ${maxPct.toFixed(1)}% · ${textoElim} · ${tempo}` +
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

    function enfileirar(d) {
        if (!rodando) return;
        const ultima = fila.length ? fila[fila.length - 1] : jogador.dir;
        if (d === ultima || fila.length >= 2) return;
        fila.push(d);
    }

    let toque = null;

    areaJogo.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        toque = { x: t.clientX, y: t.clientY };
        e.preventDefault();
    }, { passive: false });

    areaJogo.addEventListener("touchmove", (e) => {
        if (!toque) return;
        const t = e.touches[0];
        const dx = t.clientX - toque.x;
        const dy = t.clientY - toque.y;

        if (Math.hypot(dx, dy) >= 18) {
            if (Math.abs(dx) > Math.abs(dy)) enfileirar(dx > 0 ? 1 : 3);
            else enfileirar(dy > 0 ? 2 : 0);
            toque = { x: t.clientX, y: t.clientY };
        }

        e.preventDefault();
    }, { passive: false });

    areaJogo.addEventListener("touchend", () => {
        toque = null;
    });

    // Teclado do PC (para testar no VS Code)
    document.addEventListener("keydown", (e) => {
        if (tela.hidden || !rodando) return;

        const mapa = {
            ArrowUp: 0, w: 0, W: 0,
            ArrowRight: 1, d: 1, D: 1,
            ArrowDown: 2, s: 2, S: 2,
            ArrowLeft: 3, a: 3, A: 3
        };

        if (e.key in mapa) {
            enfileirar(mapa[e.key]);
            e.preventDefault();
        }
    });

    // ========================================
    // TELAS
    // ========================================

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

    // Telegram minimizado: pausa
    document.addEventListener("visibilitychange", () => {
        pausado = document.hidden;
    });

    window.addEventListener("resize", () => {
        if (rodando) dimensionar();
    });
})();
