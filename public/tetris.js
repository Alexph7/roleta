(function () {
    const telegram = window.Telegram?.WebApp;
    const initData = telegram?.initData || "";
    const Motor = window.TetrisMotor;

    const el = id => document.getElementById(id);

    const telaHabilidade = el("tela-habilidade");
    const telaTetris = el("tela-tetris");
    const botaoAbrir = el("abrir-tetris");
    const botaoVoltar = el("voltar-menu-tetris");

    const painelRegras = el("tetris-regras");
    const botaoComecar = el("tetris-comecar");
    const avisoEl = el("tetris-aviso");
    const painelJogo = el("tetris-jogo");
    const canvas = el("tetris-canvas");
    const canvasProximo = el("tetris-proximo");
    const placarPontos = el("tetris-placar-pontos");
    const placarLinhas = el("tetris-placar-linhas");
    const resultadoEl = el("resultado-tetris");
    const rankingInfo = el("tetris-ranking-info");
    const rankingLista = el("tetris-ranking-lista");
    const minhaPosicao = el("tetris-minha-posicao");

    if (
        !Motor || !telaTetris || !botaoAbrir || !botaoVoltar ||
        !painelRegras || !botaoComecar || !painelJogo || !canvas ||
        !canvasProximo || !rankingLista
    ) {
        console.error("Elementos do jogo de blocos nao encontrados.");
        return;
    }

    const CELULA = 24;

    // O tamanho do desenho segue o motor: se mudar LARGURA ou ALTURA
    // no tetris-motor.js, o campo se ajusta sozinho.
    canvas.width = Motor.LARGURA * CELULA;
    canvas.height = Motor.ALTURA * CELULA;
    canvas.style.setProperty(
        "--tetris-proporcao",
        String(Motor.ALTURA / Motor.LARGURA)
    );
    // Cores vivas (claro, normal, escuro) para dar efeito de bloco em relevo
    // topo, miolo, direita, esquerda, baixo
    const CORES = [
        ["#8ff7ff", "#18c8e6", "#0b8aa8", "#4fdff2", "#065d78"], // I
        ["#fff1a0", "#ffc800", "#c98a00", "#ffdf4d", "#8f5e00"], // O
        ["#eab6ff", "#b13df0", "#7a1fb5", "#cc7cf7", "#521080"], // T
        ["#aaf9ad", "#2fd24f", "#168a2c", "#6fe887", "#0c5a1c"], // S
        ["#ffb0aa", "#ff3b3b", "#b01524", "#ff7a74", "#750c18"], // Z
        ["#b0c0ff", "#3f66f0", "#1f3399", "#7f98ff", "#12206b"], // J
        ["#ffd08f", "#ff7f12", "#bd4d06", "#ffa94f", "#7d3003"]  // L
    ];

    // ==============================
    // FUNDO ANIMADO (pecas flutuando, brilhos e luzes)
    // ==============================

    (function criarFundoAnimado() {
        const fundo = document.createElement("div");
        fundo.className = "tetris-fundo";
        fundo.setAttribute("aria-hidden", "true");

        // [tipo, rotacao, esquerda %, topo %, tamanho px, duracao s, atraso s]
        const pecas = [
            [2, 1, 1, 10, 16, 9, 0],
            [0, 1, 88, 6, 14, 11, 2],
            [6, 0, 3, 38, 18, 10, 1],
            [3, 1, 86, 34, 16, 12, 3],
            [5, 2, 0, 66, 15, 8, 4],
            [4, 0, 87, 62, 17, 13, 1],
            [1, 0, 40, 1, 14, 10, 2],
            [0, 0, 70, 90, 13, 9, 5],
            [2, 3, 12, 92, 14, 11, 0]
        ];

        pecas.forEach(([tipo, rot, esq, topo, tam, dur, atraso]) => {
            const peca = document.createElement("div");
            peca.className = "tetris-fundo-peca";
            peca.style.left = esq + "%";
            peca.style.top = topo + "%";
            peca.style.setProperty("--d", dur + "s");
            peca.style.animationDelay = "-" + atraso + "s";
            peca.style.filter =
                "drop-shadow(0 0 7px " + CORES[tipo][1] + ")";

            Motor.celulasPeca(tipo, rot).forEach(([cx, cy]) => {
                const c = document.createElement("i");
                c.style.left = cx * tam + "px";
                c.style.top = cy * tam + "px";
                c.style.width = c.style.height = tam - 1 + "px";
                c.style.background =
                    "linear-gradient(135deg," + CORES[tipo][0] + "," +
                    CORES[tipo][1] + " 55%," + CORES[tipo][2] + ")";
                peca.appendChild(c);
            });

            fundo.appendChild(peca);
        });

        // brilhos que piscam
        for (let i = 0; i < 18; i++) {
            const b = document.createElement("b");
            b.style.left = (i * 37 + 7) % 100 + "%";
            b.style.top = (i * 53 + 11) % 100 + "%";
            b.style.animationDelay = "-" + (i % 6) * 0.7 + "s";
            b.style.animationDuration = 2.2 + (i % 5) * 0.6 + "s";
            fundo.appendChild(b);
        }

        // colunas de luz no horizonte
        for (let i = 0; i < 7; i++) {
            const l = document.createElement("u");
            l.style.left = (i * 16 + 2) % 100 + "%";
            l.style.height = 14 + (i * 7) % 18 + "%";
            l.style.animationDelay = "-" + i * 0.9 + "s";
            fundo.appendChild(l);
        }

        painelJogo.insertBefore(fundo, painelJogo.firstChild);

        // botao VOLTAR dentro do jogo (usa a mesma regra do botao de fora)
        const topo = document.createElement("div");
        topo.className = "tetris-topo";
        const voltar = document.createElement("button");
        voltar.type = "button";
        voltar.className = "tetris-voltar-jogo";
        voltar.textContent = "VOLTAR";
        voltar.addEventListener("click", () => botaoVoltar.click());
        topo.appendChild(voltar);
        painelJogo.insertBefore(topo, fundo.nextSibling);
    })();

    let jogo = null;
    let acoesFeitas = [];
    let partidaId = null;
    let rodando = false;
    let timerQueda = null;
    let timerRanking = null;
    let esperaRepeticao = null;
    let repeticao = null;
    let pendente = null; // partida terminada que ainda nao foi enviada

    // ==============================
    // SERVIDOR
    // ==============================

    async function requisicao(url, corpo) {
        const resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, ...corpo })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro no jogo.");
        }

        return dados;
    }

    // ==============================
    // DESENHO
    // ==============================

    function caminhoArredondado(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Bloco cheio, com borda grossa em relevo (luz em cima/esquerda,
    // sombra embaixo/direita), ocupando a casinha quase inteira
    function bloco(ctx, x, y, cor, tamanho) {
        const m = 0.5;
        const px = x * tamanho + m;
        const py = y * tamanho + m;
        const l = tamanho - m * 2;
        const b = Math.max(3, l * 0.22);

        // topo (claro)
        ctx.fillStyle = cor[0];
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + l, py);
        ctx.lineTo(px + l - b, py + b);
        ctx.lineTo(px + b, py + b);
        ctx.closePath();
        ctx.fill();

        // esquerda (meio claro)
        ctx.fillStyle = cor[3];
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + b, py + b);
        ctx.lineTo(px + b, py + l - b);
        ctx.lineTo(px, py + l);
        ctx.closePath();
        ctx.fill();

        // direita (escuro)
        ctx.fillStyle = cor[2];
        ctx.beginPath();
        ctx.moveTo(px + l, py);
        ctx.lineTo(px + l, py + l);
        ctx.lineTo(px + l - b, py + l - b);
        ctx.lineTo(px + l - b, py + b);
        ctx.closePath();
        ctx.fill();

        // baixo (mais escuro)
        ctx.fillStyle = cor[4];
        ctx.beginPath();
        ctx.moveTo(px, py + l);
        ctx.lineTo(px + l, py + l);
        ctx.lineTo(px + l - b, py + l - b);
        ctx.lineTo(px + b, py + l - b);
        ctx.closePath();
        ctx.fill();

        // miolo
        const grad = ctx.createLinearGradient(px, py + b, px, py + l - b);
        grad.addColorStop(0, cor[1]);
        grad.addColorStop(1, cor[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(px + b, py + b, l - b * 2, l - b * 2);

        // brilho no miolo
        ctx.fillStyle = "rgba(255,255,255,.22)";
        ctx.fillRect(px + b, py + b, l - b * 2, (l - b * 2) * 0.32);
    }

    // Marca onde a peca vai cair
    function fantasma(ctx) {
        let dy = 0;

        const cabe = d => Motor.celulas(jogo.peca).every(([x, y]) => {
            const yy = y + d;
            return x >= 0 && x < Motor.LARGURA && yy < Motor.ALTURA &&
                (yy < 0 || !jogo.tabuleiro[yy][x]);
        });

        while (cabe(dy + 1)) dy++;

        if (dy === 0) return;

        ctx.strokeStyle = "rgba(255,255,255,.55)";
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.lineWidth = 2;

        for (const [x, y] of Motor.celulas(jogo.peca)) {
            if (y + dy < 0) continue;

            caminhoArredondado(
                ctx, x * CELULA + 2, (y + dy) * CELULA + 2,
                CELULA - 4, CELULA - 4, 5
            );
            ctx.fill();
            ctx.stroke();
        }
    }

    function desenhar() {
        const ctx = canvas.getContext("2d");

        // fundo do campo e casinhas escuras
        const fundo = ctx.createLinearGradient(0, 0, 0, canvas.height);
        fundo.addColorStop(0, "#1b2a6b");
        fundo.addColorStop(1, "#101a4a");
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < Motor.ALTURA; y++) {
            for (let x = 0; x < Motor.LARGURA; x++) {
                ctx.fillStyle = "rgba(8,14,50,.5)";
                ctx.fillRect(
                    x * CELULA + 1, y * CELULA + 1, CELULA - 2, CELULA - 2
                );
            }
        }

        if (!jogo) return;

        jogo.tabuleiro.forEach((linha, y) => {
            linha.forEach((valor, x) => {
                if (valor) bloco(ctx, x, y, CORES[valor - 1], CELULA);
            });
        });

        if (!jogo.fim) {
            fantasma(ctx);

            for (const [x, y] of Motor.celulas(jogo.peca)) {
                if (y >= 0) bloco(ctx, x, y, CORES[jogo.peca.tipo], CELULA);
            }
        }

        desenharProxima();
    }

    function desenharProxima() {
        const ctx = canvasProximo.getContext("2d");
        const t = 16;

        ctx.clearRect(0, 0, canvasProximo.width, canvasProximo.height);

        if (!jogo) return;

        const tipo = jogo.fila[0];
        const cel = Motor.celulasPeca(tipo, 0);

        const xs = cel.map(c => c[0]);
        const ys = cel.map(c => c[1]);
        const larg = Math.max(...xs) - Math.min(...xs) + 1;
        const alt = Math.max(...ys) - Math.min(...ys) + 1;
        const ox = (canvasProximo.width / t - larg) / 2 - Math.min(...xs);
        const oy = (canvasProximo.height / t - alt) / 2 - Math.min(...ys);

        for (const [x, y] of cel) {
            bloco(ctx, x + ox, y + oy, CORES[tipo], t);
        }
    }

    function atualizarPlacar() {
        placarPontos.textContent = String(jogo ? jogo.pontos : 0);
        placarLinhas.textContent = String(jogo ? jogo.linhas : 0);
    }

    // ==============================
    // PARTIDA
    // ==============================

    function intervaloQueda() {
        // Fica mais rapido a cada 10 linhas.
        return Math.max(150, 800 - 50 * Math.floor(jogo.linhas / 10));
    }

    function agendarQueda() {
        clearTimeout(timerQueda);
        timerQueda = setTimeout(() => {
            if (!rodando) return;
            acao("T");
            if (rodando) agendarQueda();
        }, intervaloQueda());
    }

    function pararRepeticao() {
        clearTimeout(esperaRepeticao);
        clearInterval(repeticao);
    }

    function acao(letra) {
        if (!rodando || !jogo) return;

        Motor.aplicar(jogo, letra);
        acoesFeitas.push(letra);

        desenhar();
        atualizarPlacar();

        if (jogo.fim) {
            terminar();
        }
    }

    function pararJogo() {
        rodando = false;
        clearTimeout(timerQueda);
        pararRepeticao();
    }

    async function comecar() {
        botaoComecar.disabled = true;
        botaoComecar.textContent = "INICIANDO...";
        avisoEl.textContent = "";
        resultadoEl.textContent = "";

        try {
            const p = await requisicao("/api/tetris/iniciar", {});

            partidaId = p.partidaId;
            jogo = Motor.criarJogo(p.seed);
            acoesFeitas = [];
            pendente = null;

            painelRegras.hidden = true;
            painelJogo.hidden = false;
            botaoVoltar.hidden = true;

            atualizarPlacar();
            desenhar();

            rodando = true;
            agendarQueda();
        } catch (erro) {
            avisoEl.textContent = erro.message;
            botaoComecar.disabled = false;
            botaoComecar.textContent = "COMEÇAR";
        }
    }

    async function enviarResultado() {
        if (!pendente) return;

        botaoComecar.disabled = true;
        botaoComecar.textContent = "ENVIANDO...";

        try {
            const r = await requisicao("/api/tetris/finalizar", pendente);

            pendente = null;

            resultadoEl.textContent =
                `Fim de jogo! ${r.pontos} pontos (${r.linhas} linhas).` +
                (r.novoRecorde ? " Novo recorde!" : "") +
                (r.meu
                    ? ` Seu melhor: ${r.meu.pontos} pontos, ${r.meu.posicao}º lugar.`
                    : "");

            avisoEl.textContent = "";
            botaoComecar.textContent = "JOGAR DE NOVO";
            botaoComecar.disabled = false;

            carregarRanking();
        } catch (erro) {
            if (/validar|ranking|aberta/i.test(erro.message)) {
                // Recusado pelo servidor: nao adianta tentar de novo.
                pendente = null;
                resultadoEl.textContent = erro.message;
                botaoComecar.textContent = "JOGAR DE NOVO";
            } else {
                resultadoEl.textContent =
                    "Sem conexão para enviar sua pontuação. Toque para tentar de novo.";
                botaoComecar.textContent = "ENVIAR DE NOVO";
            }

            botaoComecar.disabled = false;
        }
    }

    function terminar() {
        pararJogo();

        pendente = {
            partidaId,
            pacote: Motor.empacotar(acoesFeitas.join(""))
        };

        painelJogo.hidden = true;
        botaoVoltar.hidden = false;
        painelRegras.hidden = false;
        resultadoEl.textContent = "Calculando sua pontuação...";

        enviarResultado();
    }

    // ==============================
    // TELAS
    // ==============================

    function mostrarTela() {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });

        telaTetris.hidden = false;
        painelRegras.hidden = false;
        painelJogo.hidden = true;
        botaoVoltar.hidden = false;
        resultadoEl.textContent = "";

        carregarEstado();
        carregarRanking();
        iniciarAtualizacaoRanking();
    }

    function sairDaTela() {
        pararJogo();
        pararAtualizacaoRanking();

        telaTetris.hidden = true;
        painelJogo.hidden = true;
        botaoVoltar.hidden = false;

        const destino = telaHabilidade || el("tela-modos");
        if (destino) destino.hidden = false;
    }

    function confirmar(mensagem, aoResponder) {
        if (telegram && typeof telegram.showConfirm === "function") {
            telegram.showConfirm(mensagem, aoResponder);
            return;
        }

        aoResponder(window.confirm(mensagem));
    }

    function voltarMenu() {
        if (rodando) {
            confirmar(
                "Sair agora perde a partida em andamento. Sair mesmo assim?",
                ok => {
                    if (ok) sairDaTela();
                }
            );
            return;
        }

        sairDaTela();
    }

    async function carregarEstado() {
        botaoComecar.disabled = true;
        botaoComecar.textContent = "CARREGANDO...";

        try {
            const e = await requisicao("/api/tetris/estado", {});

            avisoEl.textContent = e.meu
                ? `Seu melhor: ${e.meu.pontos} pontos (${e.meu.posicao}º lugar).`
                : "Você ainda não pontuou.";

            if (pendente) {
                botaoComecar.textContent = "ENVIAR DE NOVO";
            } else {
                botaoComecar.textContent = e.partidasJogadas
                    ? "JOGAR DE NOVO"
                    : "COMEÇAR";
            }

            botaoComecar.disabled = false;
        } catch (erro) {
            avisoEl.textContent = erro.message;
            botaoComecar.textContent = "TENTAR DE NOVO";
            botaoComecar.disabled = false;
        }
    }

    // ==============================
    // RANKING
    // ==============================

    function criarLinha(item, souEu) {
        const linha = document.createElement("div");
        linha.className = "tetris-rk-linha" +
            (souEu ? " tetris-rk-eu" : "");

        const posicao = document.createElement("span");
        posicao.textContent = `${item.posicao}º`;

        const nome = document.createElement("span");
        nome.className = "tetris-rk-nome";
        nome.textContent = item.nome || "Participante";

        const dados = document.createElement("strong");
        dados.className = "tetris-rk-dados";
        dados.textContent = `${item.pontos} pts · ${item.linhas} lin.`;

        linha.append(posicao, nome, dados);
        return linha;
    }

    async function carregarRanking() {
        try {
            const d = await requisicao("/api/tetris/ranking", {});

            rankingInfo.textContent =
                "Vale a maior pontuação de cada pessoa. " +
                "Cada linha completa soma 10 pontos.";

            rankingLista.replaceChildren();

            if (!d.ranking.length) {
                const vazio = document.createElement("div");
                vazio.className = "tetris-rk-vazio";
                vazio.textContent = "Ninguém pontuou ainda.";
                rankingLista.appendChild(vazio);
            }

            for (const item of d.ranking) {
                rankingLista.appendChild(
                    criarLinha(item, d.meu && d.meu.posicao === item.posicao)
                );
            }

            if (d.meu && d.meu.posicao > d.ranking.length) {
                minhaPosicao.textContent =
                    `Sua posição: ${d.meu.posicao}º · ${d.meu.pontos} pts`;
                minhaPosicao.hidden = false;
            } else {
                minhaPosicao.hidden = true;
            }
        } catch (erro) {
            console.error("Erro ao carregar ranking do tetris:", erro);
        }
    }

    function iniciarAtualizacaoRanking() {
        pararAtualizacaoRanking();
        timerRanking = setInterval(carregarRanking, 10000);
    }

    function pararAtualizacaoRanking() {
        clearInterval(timerRanking);
        timerRanking = null;
    }

    // ==============================
    // CONTROLES
    // ==============================

    document.querySelectorAll("#tela-tetris [data-acao]").forEach(botao => {
        const letra = botao.dataset.acao;
        const repete = letra === "L" || letra === "R" || letra === "D";

        botao.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            acao(letra);

            if (repete) {
                pararRepeticao();
                esperaRepeticao = setTimeout(() => {
                    repeticao = setInterval(() => acao(letra), 70);
                }, 170);
            }
        });

        ["pointerup", "pointerleave", "pointercancel"].forEach(nome => {
            botao.addEventListener(nome, pararRepeticao);
        });

        botao.addEventListener("contextmenu", ev => ev.preventDefault());
    });

    document.addEventListener("keydown", ev => {
        if (!rodando) return;

        const mapa = {
            ArrowLeft: "L",
            ArrowRight: "R",
            ArrowDown: "D",
            ArrowUp: "C",
            " ": "H"
        };

        const letra = mapa[ev.key];
        if (!letra) return;

        ev.preventDefault();

        if (ev.repeat && (letra === "C" || letra === "H")) return;

        acao(letra);
    });

    // Toque direto no campo, usando a PECA como referencia:
    //  - tocar a direita da peca: move para a direita (segurar repete)
    //  - tocar a esquerda da peca: move para a esquerda (segurar repete)
    //  - tocar em cima da peca: gira
    //  - tocar abaixo da peca: acelera a descida (segurar repete)
    //  - arrastar para baixo: queda direta
    (function ativarToqueNoCampo() {
        let inicio = null;
        let esperaToque = null;
        let ultimo = { x: 0, y: 0 };

        function zona(x, y) {
            if (!jogo || jogo.fim) return "C";

            const caixa = canvas.getBoundingClientRect();
            const larguraCelula = caixa.width / Motor.LARGURA;
            const alturaCelula = caixa.height / Motor.ALTURA;

            const cel = Motor.celulas(jogo.peca);
            const colEsq = Math.min(...cel.map(c => c[0]));
            const colDir = Math.max(...cel.map(c => c[0]));
            const linhaBaixo = Math.max(...cel.map(c => c[1]));

            const esquerda = caixa.left + colEsq * larguraCelula;
            const direita = caixa.left + (colDir + 1) * larguraCelula;
            const baixo = caixa.top + (linhaBaixo + 1) * alturaCelula;

            if (x < esquerda) return "L";
            if (x > direita) return "R";
            if (y > baixo) return "D";
            return "C";
        }

        function limpar() {
            clearTimeout(esperaToque);
            pararRepeticao();
            inicio = null;
        }

        // Repetir enquanto o dedo estiver segurando: a peca vai
        // ate o dedo e para quando chegar nele (nao gira sozinha).
        function repetirUmaVez() {
            const letra = zona(ultimo.x, ultimo.y);
            if (letra !== "C") acao(letra);
        }

        painelJogo.addEventListener("pointerdown", ev => {
            if (!rodando) return;

            // botoes e placar continuam funcionando normalmente
            if (ev.target.closest("button, .tetris-placar")) return;

            ev.preventDefault();

            try {
                painelJogo.setPointerCapture(ev.pointerId);
            } catch (erro) {
                // sem captura, segue normal
            }

            limpar();

            ultimo = { x: ev.clientX, y: ev.clientY };

            inicio = {
                x: ev.clientX,
                y: ev.clientY,
                zona: zona(ev.clientX, ev.clientY),
                moveu: false,
                repetindo: false
            };

            if (inicio.zona !== "C") {
                esperaToque = setTimeout(() => {
                    if (!inicio || inicio.moveu) return;

                    inicio.repetindo = true;
                    repetirUmaVez();
                    repeticao = setInterval(repetirUmaVez, 70);
                }, 200);
            }
        });

        painelJogo.addEventListener("pointermove", ev => {
            ultimo = { x: ev.clientX, y: ev.clientY };

            if (!inicio || inicio.moveu) return;

            const dx = ev.clientX - inicio.x;
            const dy = ev.clientY - inicio.y;

            if (dy > 60 && dy > Math.abs(dx) * 1.5) {
                inicio.moveu = true;
                clearTimeout(esperaToque);
                pararRepeticao();
                acao("H");
            }
        });

        painelJogo.addEventListener("pointerup", () => {
            if (inicio && !inicio.moveu && !inicio.repetindo) {
                acao(inicio.zona);
            }

            limpar();
        });

        painelJogo.addEventListener("pointercancel", limpar);
        painelJogo.addEventListener("contextmenu", ev => ev.preventDefault());
    })();

    // Se o app for para o fundo, a queda pausa.
    document.addEventListener("visibilitychange", () => {
        if (!rodando) return;

        if (document.hidden) {
            clearTimeout(timerQueda);
            pararRepeticao();
        } else {
            agendarQueda();
        }
    });

    botaoComecar.addEventListener("click", () => {
        if (pendente) {
            enviarResultado();
        } else {
            comecar();
        }
    });

    botaoAbrir.addEventListener("click", mostrarTela);
    botaoVoltar.addEventListener("click", voltarMenu);

    desenhar();
})();