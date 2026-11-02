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
    const placarTempo = el("memoria-placar-partida");
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

    const TOTAL_CARTAS = 36;
    const TOTAL_PARES = TOTAL_CARTAS / 2;
    const ESPERA_ERRO_MS = 900;

    const EMOJIS = [
        0x1F34E, 0x1F349, 0x1F680, 0x1F31F, 0x1F381, 0x1F984,
        0x1F43C, 0x1F355, 0x26BD, 0x1F308, 0x1F438, 0x1F431,
        0x1F436, 0x1F354, 0x1F388, 0x1F3C6, 0x1F6B2, 0x1F3B8
    ].map(codigo => String.fromCodePoint(codigo));

    let cartas = [];            // emoji de cada posicao
    let abertas = [];           // posicoes viradas e ainda sem par
    let encontradas = new Set();
    let jogadas = 0;
    let bloqueado = false;
    let inicioEm = null;
    let relogio = null;
    let emAndamento = false;

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

    function formatarTempo(ms) {
        const total = Math.max(0, Math.round(ms / 1000));
        const min = Math.floor(total / 60);
        const seg = String(total % 60).padStart(2, "0");

        return `${min}:${seg}`;
    }

    function embaralhar() {
        const lista = [...EMOJIS, ...EMOJIS];

        for (let i = lista.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lista[i], lista[j]] = [lista[j], lista[i]];
        }

        return lista;
    }

    function atualizarRelogio() {
        placarTempo.textContent = inicioEm
            ? formatarTempo(Date.now() - inicioEm)
            : "0:00";
    }

    function pararRelogio() {
        clearInterval(relogio);
        relogio = null;
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
        pararRelogio();

        cartas = embaralhar();
        abertas = [];
        encontradas = new Set();
        jogadas = 0;
        bloqueado = false;
        inicioEm = null;
        emAndamento = true;

        criarGrade();
        atualizarPlacar();
        atualizarRelogio();

        regras.hidden = true;
        jogo.hidden = false;
        botaoDeNovo.hidden = true;

        resultado.textContent =
            `Encontre os ${TOTAL_PARES} pares com o menor número de jogadas.`;
    }

    function comecar() {
        // precisa ser logo no toque do botao, senao o celular bloqueia o som
        musica.tocar();
        novaPartida();
    }

    function terminar() {
        emAndamento = false;
        pararRelogio();
        atualizarRelogio();
        musica.pausar();

        resultado.textContent =
            `Concluído! ${jogadas} jogadas em ` +
            `${formatarTempo(Date.now() - inicioEm)}.`;

        botaoDeNovo.hidden = false;
    }

    function virar(indice) {
        if (bloqueado || !emAndamento) return;
        if (encontradas.has(indice) || abertas.includes(indice)) return;

        if (!inicioEm) {
            inicioEm = Date.now();
            relogio = setInterval(atualizarRelogio, 500);
        }

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
        pararRelogio();
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