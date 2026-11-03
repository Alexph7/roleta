(function () {
    const el = id => document.getElementById(id);

    const telaModos = el("tela-modos");
    const telaHabilidade = el("tela-habilidade");
    const telaMemoria = el("tela-memoria");
    const botaoAbrir = el("abrir-memoria");
    const botaoVoltar = el("voltar-menu-memoria");
    const botaoSom = el("memoria-som");

    const regras = el("memoria-regras");
    const botaoComecar = el("memoria-comecar");

    const jogo = el("memoria-jogo");
    const placarJogadas = el("memoria-placar-jogadas");
    const placarPares = el("memoria-placar-pares");
    const grade = el("memoria-grade");
    const resultado = el("resultado-memoria");
    const botaoDeNovo = el("memoria-de-novo");

    if (
        !telaMemoria || !botaoAbrir || !botaoVoltar || !grade ||
        !regras || !jogo || !botaoComecar || !botaoDeNovo
    ) {
        console.error("Elementos do jogo da memoria nao encontrados.");
        return;
    }

    const TOTAL_CARTAS = 48;
    const TOTAL_PARES = TOTAL_CARTAS / 2;
    const ESPERA_ERRO_MS = 900;

    const EMOJIS = [
        0x1F34E, 0x1F349, 0x1F680, 0x1F31F, 0x1F381, 0x1F984,
        0x1F43C, 0x1F355, 0x26BD, 0x1F308, 0x1F438, 0x1F431,
        0x1F436, 0x1F354, 0x1F388, 0x1F3C6, 0x1F6B2, 0x1F3B8,
        0x1F353, 0x1F419, 0x1F33B, 0x1F369, 0x1F98A, 0x1F3AE
    ].map(codigo => String.fromCodePoint(codigo));

    let cartas = [];            // emoji de cada posicao
    let abertas = [];           // posicoes viradas e ainda sem par
    let encontradas = new Set();
    let jogadas = 0;
    let bloqueado = false;
    let emAndamento = false;

    // ==============================
    // FUNDO ANIMADO (suave, para relaxar)
    // ==============================

    (function criarFundo() {
        const fundo = document.createElement("div");
        fundo.className = "memoria-fundo";
        fundo.setAttribute("aria-hidden", "true");

        // [emoji, esquerda %, topo %, tamanho px, duracao s, atraso s]
        const flutuantes = [
            [0, 6, 8, 34, 14, 0], [3, 82, 12, 30, 16, 3],
            [6, 90, 40, 36, 18, 5], [9, 3, 45, 32, 15, 2],
            [12, 14, 72, 38, 17, 6], [15, 78, 76, 34, 14, 1],
            [18, 46, 4, 28, 19, 4], [21, 50, 90, 30, 16, 7],
            [1, 30, 28, 26, 20, 8], [4, 68, 55, 26, 18, 9]
        ];

        flutuantes.forEach(([i, esq, topo, tam, dur, atraso]) => {
            const f = document.createElement("span");
            f.className = "memoria-fundo-emoji";
            f.textContent = EMOJIS[i % EMOJIS.length];
            f.style.left = esq + "%";
            f.style.top = topo + "%";
            f.style.fontSize = tam + "px";
            f.style.setProperty("--d", dur + "s");
            f.style.animationDelay = "-" + atraso + "s";
            fundo.appendChild(f);
        });

        for (let i = 0; i < 16; i++) {
            const b = document.createElement("b");
            b.style.left = (i * 41 + 9) % 100 + "%";
            b.style.top = (i * 57 + 13) % 100 + "%";
            b.style.animationDelay = "-" + (i % 6) * 0.8 + "s";
            b.style.animationDuration = 2.6 + (i % 5) * 0.7 + "s";
            fundo.appendChild(b);
        }

        telaMemoria.insertBefore(fundo, telaMemoria.firstChild);
    })();

    // ==============================
    // MUSICA DE FUNDO
    // ==============================

    const musica = (function () {
        const ARQUIVO = "/musica-memoria.mp3";
        const VOLUME = 0.4;
        const CHAVE = "memoria_som_desligado";
        let audio = null;
        let mudo = false;

        try {
            mudo = localStorage.getItem(CHAVE) === "1";
        } catch (erro) {
            // sem armazenamento, segue com o som ligado
        }

        function tocar() {
            if (mudo) return;

            if (!audio) {
                audio = new Audio(ARQUIVO);
                audio.loop = true;
                audio.volume = VOLUME;
            }

            const r = audio.play();
            if (r && r.catch) r.catch(() => {});
        }

        function pausar() {
            if (audio) audio.pause();
        }

        // Comeca a baixar a musica antes do jogo, sem tocar
        function preparar() {
            if (!audio && !mudo) {
                audio = new Audio(ARQUIVO);
                audio.loop = true;
                audio.volume = VOLUME;
                audio.preload = "auto";
            }
        }

        function alternar(tocando) {
            mudo = !mudo;

            try {
                localStorage.setItem(CHAVE, mudo ? "1" : "0");
            } catch (erro) {
                // vale so nesta visita
            }

            if (mudo) pausar();
            else if (tocando) tocar();

            return mudo;
        }

        return { tocar, pausar, preparar, alternar, estaMudo: () => mudo };
    })();

    function textoSom() {
        if (!botaoSom) return;

        botaoSom.textContent = musica.estaMudo() ? "SOM OFF" : "SOM ON";
        botaoSom.classList.toggle("memoria-som-off", musica.estaMudo());
    }

    // ==============================
    // JOGO
    // ==============================

    function embaralhar() {
        const lista = [...EMOJIS, ...EMOJIS];

        for (let i = lista.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lista[i], lista[j]] = [lista[j], lista[i]];
        }

        return lista;
    }

    function atualizarPlacar() {
        placarJogadas.textContent = String(jogadas);
        placarPares.textContent = `${encontradas.size / 2}/${TOTAL_PARES}`;
    }

    function desenharCarta(botao, indice) {
        const achada = encontradas.has(indice);
        const aberta = achada || abertas.includes(indice);

        botao.textContent = aberta ? cartas[indice] : "";
        botao.classList.toggle("aberta", aberta);
        botao.classList.toggle("encontrada", achada);
        botao.disabled = achada;
    }

    function desenharTudo() {
        grade.querySelectorAll(".memoria-carta").forEach(botao => {
            desenharCarta(botao, Number(botao.dataset.indice));
        });
    }

    function criarGrade() {
        grade.replaceChildren();

        for (let indice = 0; indice < TOTAL_CARTAS; indice++) {
            const botao = document.createElement("button");

            botao.type = "button";
            botao.className = "memoria-carta";
            botao.dataset.indice = String(indice);
            botao.addEventListener("click", () => virar(indice));

            grade.appendChild(botao);
        }
    }

    function novaPartida() {
        cartas = embaralhar();
        abertas = [];
        encontradas = new Set();
        jogadas = 0;
        bloqueado = false;
        emAndamento = true;

        criarGrade();
        atualizarPlacar();

        regras.hidden = true;
        jogo.hidden = false;
        botaoDeNovo.hidden = true;

        resultado.textContent =
            `Encontre os ${TOTAL_PARES} pares.`;
    }

    function comecar() {
        // precisa ser logo no toque do botao, senao o celular bloqueia o som
        musica.tocar();
        novaPartida();
    }

    function terminar() {
        emAndamento = false;
        musica.pausar();

        resultado.textContent =
            `Parabéns! Você encontrou todos os pares em ${jogadas} jogadas.`;

        botaoDeNovo.hidden = false;
    }

    function virar(indice) {
        if (bloqueado || !emAndamento) return;
        if (encontradas.has(indice) || abertas.includes(indice)) return;

        abertas.push(indice);
        desenharTudo();

        if (abertas.length < 2) return;

        // segunda carta: conta 1 jogada
        jogadas++;

        const [a, b] = abertas;

        if (cartas[a] === cartas[b]) {
            encontradas.add(a);
            encontradas.add(b);
            abertas = [];

            atualizarPlacar();
            desenharTudo();

            if (encontradas.size === TOTAL_CARTAS) terminar();

            return;
        }

        bloqueado = true;
        atualizarPlacar();

        setTimeout(() => {
            abertas = [];
            bloqueado = false;
            desenharTudo();
        }, ESPERA_ERRO_MS);
    }

    // ==============================
    // TELAS
    // ==============================

    function mostrarTela() {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });

        telaMemoria.hidden = false;
        regras.hidden = false;
        jogo.hidden = true;
        botaoDeNovo.hidden = true;
        resultado.textContent = "";
        emAndamento = false;

        textoSom();
        musica.preparar();
    }

    function sairDaTela() {
        emAndamento = false;
        musica.pausar();

        telaMemoria.hidden = true;
        regras.hidden = false;
        jogo.hidden = true;

        const destino = telaHabilidade || telaModos;
        if (destino) destino.hidden = false;
    }

    document.addEventListener("visibilitychange", () => {
        if (telaMemoria.hidden) return;

        if (document.hidden) musica.pausar();
        else if (emAndamento) musica.tocar();
    });

    if (botaoSom) {
        botaoSom.addEventListener("click", () => {
            musica.alternar(emAndamento);
            textoSom();
        });
    }

    botaoAbrir.addEventListener("click", mostrarTela);
    botaoVoltar.addEventListener("click", sairDaTela);
    botaoComecar.addEventListener("click", comecar);
    botaoDeNovo.addEventListener("click", comecar);
})();