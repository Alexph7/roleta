// ==============================
// JOGO DA MEMÓRIA - DUELO (2 JOGADORES)
// Arquivo separado: o modo solo (memoria.js) continua igual.
// ==============================

(function () {
    const el = id => document.getElementById(id);

    const telaAcesso = el("tela-acesso");
    const telaMemoria = el("tela-memoria");
    const botaoAbrir = el("abrir-memoria");
    const botaoVoltar = el("voltar-menu-memoria");
    const botaoSolo = el("memoria-comecar");
    const botaoConvidar = el("memoria-duelo-convidar");

    const regras = el("memoria-regras");
    const jogoSolo = el("memoria-jogo");
    const resultadoSolo = el("resultado-memoria");
    const botaoDeNovoSolo = el("memoria-de-novo");

    const area = el("memoria-duelo");
    const espera = el("memoria-duelo-espera");
    const esperaTexto = el("memoria-duelo-espera-texto");
    const esperaTempo = el("memoria-duelo-espera-tempo");
    const botaoCancelar = el("memoria-duelo-cancelar");

    const partidaArea = el("memoria-duelo-partida");
    const caixaJ1 = el("memoria-duelo-j1");
    const caixaJ2 = el("memoria-duelo-j2");
    const barraTempo = el("memoria-duelo-barra");
    const aviso = el("memoria-duelo-aviso");
    const grade = el("memoria-duelo-grade");

    const final = el("memoria-duelo-final");
    const finalTitulo = el("memoria-duelo-final-titulo");
    const finalIcone = el("memoria-duelo-final-icone");
    const finalSub = el("memoria-duelo-final-sub");
    const finalPlacar = el("memoria-duelo-final-placar");
    const botaoFinalSolo = el("memoria-duelo-final-solo");
    const botaoFinalConvidar = el("memoria-duelo-final-convidar");
    const botaoFinalVoltar = el("memoria-duelo-final-voltar");

    if (!telaMemoria || !botaoConvidar || !area || !grade || !final) {
        console.error("Elementos do duelo da memória não encontrados.");
        return;
    }

    const telegram = window.Telegram?.WebApp;
    const INTERVALO_ESTADO_MS = 1500;
    const TEMPO_REVELAR_MS = 1400;

    let codigo = null;
    let estado = null;
    let recebidoEm = 0;          // hora em que o estado chegou
    let timerEstado = null;
    let timerRelogio = null;
    let enviando = false;
    let ultimoSeqRevelado = -1;
    let revelando = [];          // cartas erradas mostradas por um instante
    let revelarAte = 0;
    let clicadaLocal = null;     // carta tocada aguardando o servidor
    let ativo = false;           // duelo aberto nesta tela

    // ==============================
    // SERVIDOR
    // ==============================

    async function chamar(rota, extras = {}) {
        const resposta = await fetch(`/api/memoria-duelo/${rota}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                initData: telegram?.initData || "",
                ...extras
            })
        });

        let dados = {};
        try { dados = await resposta.json(); } catch {}

        return { ok: resposta.ok, dados };
    }

    function vibrar(tipo) {
        try { telegram?.HapticFeedback?.notificationOccurred(tipo); } catch {}
    }

    // ==============================
    // TELAS
    // ==============================

    function esconderSolo() {
        const painel = el("memoria-ranking");
        if (painel) painel.hidden = true;
        regras.hidden = true;
        jogoSolo.hidden = true;
        botaoDeNovoSolo.hidden = true;
        resultadoSolo.textContent = "";
    }

    function mostrarRegras(mensagem = "") {
        parar();
        mostrarRankingAbaixo();
        area.hidden = true;
        final.hidden = true;
        jogoSolo.hidden = true;
        botaoDeNovoSolo.hidden = true;
        regras.hidden = false;
        resultadoSolo.textContent = mensagem;
    }

    function mostrarEspera() {
        esconderSolo();
        final.hidden = true;
        area.hidden = false;
        espera.hidden = false;
        partidaArea.hidden = true;
    }

    function mostrarPartida() {
        esconderSolo();
        final.hidden = true;
        area.hidden = false;
        espera.hidden = true;
        partidaArea.hidden = false;
    }

    function parar() {
        ativo = false;
        clearTimeout(timerEstado);
        clearInterval(timerRelogio);
        timerEstado = null;
        timerRelogio = null;
    }

    // ==============================
    // CONVIDAR
    // ==============================

    async function convidar() {
        if (enviando) return;
        enviando = true;
        botaoConvidar.disabled = true;
        botaoFinalConvidar.disabled = true;

        try {
            const { ok, dados } = await chamar("convidar");

            if (!ok) {
                if (dados.motivo === "aguarde") {
                    const s = Math.ceil((dados.esperarMs || 0) / 1000);
                    mostrarRegras(`Espere ${s} segundos para convidar de novo.`);
                } else if (dados.motivo === "em_partida" && dados.codigo) {
                    abrirPartida(dados.codigo);
                } else {
                    mostrarRegras(dados.erro || "Não foi possível convidar agora.");
                }
                return;
            }

            iniciar(dados);

        } catch {
            mostrarRegras("Sem conexão. Tente de novo.");
        } finally {
            enviando = false;
            botaoConvidar.disabled = false;
            botaoFinalConvidar.disabled = false;
        }
    }

    async function cancelar() {
        const cod = codigo;
        parar();
        codigo = null;
        mostrarRegras("Convite cancelado.");

        if (cod) {
            try { await chamar("cancelar", { codigo: cod }); } catch {}
        }
    }

    // ==============================
    // ENTRAR PELO LINK DO CONVITE
    // ==============================

    async function entrarPeloLink(cod) {
        abrirTelaMemoria();
        mostrarRegras("Entrando na partida...");

        try {
            const { ok, dados } = await chamar("entrar", { codigo: cod });

            if (!ok) {
                if (dados.motivo === "em_partida" && dados.codigo) {
                    abrirPartida(dados.codigo);
                    return;
                }

                mostrarRegras(
                    dados.erro ||
                    "Alguém já entrou, mas você pode começar um jogo sozinho ou convidar alguém também."
                );
                return;
            }

            iniciar(dados);

        } catch {
            mostrarRegras("Sem conexão. Tente de novo.");
        }
    }

    async function abrirPartida(cod) {
        codigo = cod;
        try {
            const { ok, dados } = await chamar("estado", { codigo: cod });
            if (ok) iniciar(dados);
            else mostrarRegras(dados.erro || "Partida não encontrada.");
        } catch {
            mostrarRegras("Sem conexão. Tente de novo.");
        }
    }

    function abrirTelaMemoria() {
        if (telaMemoria.hidden) botaoAbrir.click();
    }

    // ==============================
    // CICLO DO ESTADO
    // ==============================

    function iniciar(dados) {
        parar();
        ativo = true;
        codigo = dados.codigo;
        ultimoSeqRevelado = dados.seq;
        revelando = [];
        criarGrade(dados.totalCartas || 48);
        receber(dados);

        timerRelogio = setInterval(atualizarRelogio, 200);
        agendarEstado();
    }

    function agendarEstado() {
        clearTimeout(timerEstado);
        if (!ativo) return;
        timerEstado = setTimeout(buscarEstado, INTERVALO_ESTADO_MS);
    }

    async function buscarEstado() {
        if (!ativo || !codigo) return;

        if (document.hidden) {
            agendarEstado();
            return;
        }

        try {
            const { ok, dados } = await chamar("estado", { codigo });
            if (ok && ativo && dados.codigo === codigo) receber(dados);
        } catch {
            // sem conexão: tenta de novo no próximo ciclo
        }

        agendarEstado();
    }

    function receber(dados) {
        const anterior = estado;
        estado = dados;
        recebidoEm = Date.now();

        // Mostra por um instante as cartas de um par errado
        if (
            dados.ultima &&
            dados.seq !== ultimoSeqRevelado &&
            dados.ultima.tipo === "par" &&
            !dados.ultima.combinou
        ) {
            revelando = dados.ultima.cartas.map(c => c);
            revelarAte = Date.now() + TEMPO_REVELAR_MS;
            setTimeout(desenhar, TEMPO_REVELAR_MS + 20);
        }

        if (anterior && dados.seq !== anterior.seq) {
            if (
                dados.status === "jogando" &&
                dados.vez === dados.eu &&
                anterior.vez !== dados.eu
            ) {
                vibrar("success");
            }
        }

        ultimoSeqRevelado = dados.seq;

        if (dados.status === "aguardando") {
            mostrarEspera();
            atualizarRelogio();
            return;
        }

        if (dados.status === "jogando") {
            mostrarPartida();
            desenhar();
            atualizarRelogio();
            return;
        }

        if (dados.status === "finalizada") {
            mostrarPartida();
            desenhar();
            parar();
            setTimeout(() => mostrarFinal(dados), 900);
            return;
        }

        // expirada ou cancelada
        parar();
        codigo = null;
        mostrarRegras(
            dados.status === "expirada"
                ? "Ninguém entrou a tempo. Você pode jogar sozinho ou convidar de novo."
                : "Convite cancelado."
        );
    }

    // ==============================
    // DESENHO
    // ==============================

    function criarGrade(total) {
        grade.replaceChildren();

        for (let indice = 0; indice < total; indice++) {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "memoria-carta";
            botao.dataset.indice = String(indice);
            botao.addEventListener("click", () => tocar(indice));
            grade.appendChild(botao);
        }
    }

    function nomeJogador(numero) {
        const j = estado?.jogadores?.[numero - 1];
        return j?.nome || (numero === estado?.eu ? "Você" : "Adversário");
    }

    function desenharPlacar() {
        [caixaJ1, caixaJ2].forEach((caixa, i) => {
            const numero = i + 1;
            const j = estado.jogadores[i];

            caixa.querySelector(".md-nome").textContent =
                (j.nome || "Aguardando...") + (numero === estado.eu ? " (você)" : "");
            caixa.querySelector(".md-pontos").textContent = String(j.pontos);
            caixa.classList.toggle(
                "md-vez",
                estado.status === "jogando" && estado.vez === numero
            );
        });
    }

    function desenhar() {
        if (!estado) return;

        desenharPlacar();

        const abertas = new Map();

        for (const c of estado.encontradas) {
            abertas.set(c.indice, { emoji: c.emoji, dono: c.jogador });
        }

        if (estado.selecionada) {
            abertas.set(estado.selecionada.indice, { emoji: estado.selecionada.emoji });
        }

        if (Date.now() < revelarAte) {
            for (const c of revelando) {
                if (!abertas.has(c.indice)) {
                    abertas.set(c.indice, { emoji: c.emoji, errada: true });
                }
            }
        }

        const minhaVez = estado.status === "jogando" && estado.vez === estado.eu;

        grade.querySelectorAll(".memoria-carta").forEach(botao => {
            const indice = Number(botao.dataset.indice);
            const carta = abertas.get(indice);
            const esperando = clicadaLocal === indice && !carta;

            botao.textContent = carta ? carta.emoji : "";
            botao.classList.toggle("aberta", Boolean(carta) || esperando);
            botao.classList.toggle("encontrada", Boolean(carta?.dono));
            botao.classList.toggle("md-dono-1", carta?.dono === 1);
            botao.classList.toggle("md-dono-2", carta?.dono === 2);
            botao.classList.toggle("md-errada", Boolean(carta?.errada));
            botao.disabled = Boolean(carta?.dono) || !minhaVez;
        });

        grade.classList.toggle("md-bloqueada", !minhaVez);
    }

    function atualizarRelogio() {
        if (!estado) return;

        const passou = Date.now() - recebidoEm;

        if (estado.status === "aguardando") {
            const resta = Math.max(0, estado.expiraEm - Date.now());
            const min = Math.floor(resta / 60000);
            const seg = Math.floor((resta % 60000) / 1000);

            esperaTexto.textContent =
                "Convite enviado no grupo! Esperando alguém entrar...";
            esperaTempo.textContent =
                `O convite some em ${min}:${String(seg).padStart(2, "0")}`;
            return;
        }

        if (estado.status !== "jogando") return;

        const comecaEm = Math.max(0, estado.vezComecaEmMs - passou);
        const resta = Math.max(0, estado.vezRestanteMs - passou);
        const fracao = Math.min(1, resta / estado.tempoVezMs);

        barraTempo.style.width = `${(fracao * 100).toFixed(1)}%`;
        barraTempo.classList.toggle("md-pouco", fracao < 0.3);

        const minhaVez = estado.vez === estado.eu;
        const segundos = Math.ceil(resta / 1000);

        if (comecaEm > 0 && estado.ultima === null) {
            aviso.textContent = minhaVez
                ? "Você começa! Prepare-se..."
                : `${nomeJogador(estado.vez)} começa. Prepare-se...`;
        } else if (comecaEm > 0) {
            aviso.textContent = minhaVez
                ? "Errou! Agora é a sua vez."
                : `Errou! Vez de ${nomeJogador(estado.vez)}.`;
        } else if (estado.ultima?.tipo === "tempo" && passou < 2500) {
            aviso.textContent = "O tempo acabou e a vez passou.";
        } else if (minhaVez) {
            aviso.textContent = `SUA VEZ! ${segundos}s`;
        } else {
            aviso.textContent = `Vez de ${nomeJogador(estado.vez)} (${segundos}s)`;
        }

        aviso.classList.toggle("md-aviso-minha", minhaVez && comecaEm === 0);

        if (revelando.length && Date.now() >= revelarAte) {
            revelando = [];
            desenhar();
        }
    }

    // ==============================
    // JOGADA
    // ==============================

    async function tocar(indice) {
        if (!estado || estado.status !== "jogando") return;
        if (estado.vez !== estado.eu || enviando) return;

        enviando = true;
        clicadaLocal = indice;
        desenhar();

        try {
            const { ok, dados } = await chamar("jogada", { codigo, indice });

            clicadaLocal = null;

            if (ok) {
                if (dados.ultima?.tipo === "par" && dados.ultima.combinou &&
                    dados.seq !== ultimoSeqRevelado) {
                    vibrar("success");
                }
                receber(dados);
            } else {
                desenhar();
                if (dados.erro) {
                    aviso.textContent = dados.erro;
                }
            }
        } catch {
            clicadaLocal = null;
            desenhar();
        } finally {
            enviando = false;
        }
    }

    // ==============================
    // TELA FINAL
    // ==============================

    function mostrarFinal(dados) {
        const eu = dados.eu;
        const outro = eu === 1 ? 2 : 1;
        const venci = dados.vencedor === eu;
        const empate = dados.vencedor === 0;

        final.classList.remove("md-final-vitoria", "md-final-derrota", "md-final-empate");

        if (empate) {
            final.classList.add("md-final-empate");
            finalIcone.textContent = "🤝";
            finalTitulo.textContent = "EMPATE!";
            finalSub.textContent = "Ninguém ficou para trás. Que tal a revanche?";
        } else if (venci) {
            final.classList.add("md-final-vitoria");
            finalIcone.textContent = "🏆";
            finalTitulo.textContent = "VOCÊ VENCEU!";
            finalSub.textContent = dados.motivoFim === "abandono"
                ? `${nomeJogador(outro)} saiu da partida.`
                : "Memória de campeão!";
            vibrar("success");
        } else {
            final.classList.add("md-final-derrota");
            finalIcone.textContent = "🥈";
            finalTitulo.textContent = `${nomeJogador(dados.vencedor).toUpperCase()} VENCEU`;
            finalSub.textContent = dados.motivoFim === "abandono"
                ? "Você perdeu a vez 3 vezes seguidas."
                : "Foi por pouco! Chame para a revanche.";
        }

        finalPlacar.replaceChildren();

        const ordem = [...dados.jogadores].sort((a, b) => b.pontos - a.pontos);

        for (const j of ordem) {
            const linha = document.createElement("div");
            linha.className = "md-final-linha";
            if (dados.vencedor === j.numero) linha.classList.add("md-final-ganhou");
            linha.classList.add(`md-cor-${j.numero}`);

            const nome = document.createElement("span");
            nome.textContent =
                (dados.vencedor === j.numero ? "👑 " : "") +
                (j.nome || "Jogador") +
                (j.numero === eu ? " (você)" : "");

            const pts = document.createElement("strong");
            pts.textContent = `${j.pontos} ${j.pontos === 1 ? "par" : "pares"}`;

            linha.append(nome, pts);
            finalPlacar.appendChild(linha);
        }

        criarConfete(venci || empate);

        area.hidden = true;
        final.hidden = false;
        codigo = null;
    }

    function criarConfete(muito) {
        final.querySelectorAll(".md-confete").forEach(c => c.remove());

        const cores = ["#ffd166", "#06d6a0", "#4cc9f0", "#f72585", "#9b5de5", "#ff6b6b"];
        const quantidade = muito ? 40 : 12;

        for (let i = 0; i < quantidade; i++) {
            const c = document.createElement("i");
            c.className = "md-confete";
            c.style.left = `${(i * 37 + 7) % 100}%`;
            c.style.background = cores[i % cores.length];
            c.style.animationDelay = `${(i % 10) * 0.25}s`;
            c.style.animationDuration = `${2.6 + (i % 4) * 0.5}s`;
            final.appendChild(c);
        }
    }

    // ==============================
    // RANKINGS (SOLO E DUELOS)
    // ==============================

    const painelRanking = el("memoria-ranking");
    const abaSolo = el("memoria-ranking-aba-solo");
    const abaDuelos = el("memoria-ranking-aba-duelos");
    const rankingInfo = el("memoria-ranking-info");
    const rankingLista = el("memoria-ranking-lista");

    let abaAtual = "solo";

    function formatarTempo(ms) {
        const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    }

    function medalha(posicao) {
        if (posicao === 1) return "🥇";
        if (posicao === 2) return "🥈";
        if (posicao === 3) return "🥉";
        return `${posicao}º`;
    }

    function linhaRanking(posicao, nome, valor, destaque) {
        const linha = document.createElement("div");
        linha.className = "md-rank-linha" + (destaque ? " md-rank-eu" : "");

        const pos = document.createElement("span");
        pos.className = "md-rank-pos";
        pos.textContent = medalha(posicao);

        const n = document.createElement("span");
        n.className = "md-rank-nome";
        n.textContent = nome || "Jogador";

        const v = document.createElement("strong");
        v.textContent = valor;

        linha.append(pos, n, v);
        return linha;
    }

    async function carregarRanking() {
        abaSolo.classList.toggle("ativa", abaAtual === "solo");
        abaDuelos.classList.toggle("ativa", abaAtual === "duelos");

        rankingInfo.textContent = abaAtual === "solo"
            ? "Melhor partida de cada um: menos jogadas. Empate: menor tempo."
            : "Mais vitórias. Empate: mais pares somados.";

        rankingLista.replaceChildren();
        const carregando = document.createElement("p");
        carregando.textContent = "Carregando...";
        rankingLista.appendChild(carregando);

        const meuId = String(telegram?.initDataUnsafe?.user?.id || "");
        const aba = abaAtual;

        try {
            const rota = aba === "solo" ? "/api/memoria-solo/ranking" : "/api/memoria-duelo/ranking";
            const resposta = await fetch(rota, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ initData: telegram?.initData || "" })
            });
            const dados = await resposta.json();

            if (aba !== abaAtual) return;
            if (!resposta.ok) throw new Error(dados.erro);

            rankingLista.replaceChildren();
            const lista = dados.ranking || [];

            if (!lista.length) {
                const vazio = document.createElement("p");
                vazio.textContent = "Ninguém no ranking ainda. Seja o primeiro!";
                rankingLista.appendChild(vazio);
                return;
            }

            for (const item of lista) {
                const valor = aba === "solo"
                    ? `${item.jogadas} jog. · ${formatarTempo(item.tempoMs)}`
                    : `${item.vitorias} V · ${item.pares} pares`;

                rankingLista.appendChild(
                    linhaRanking(item.posicao, item.nome, valor, item.usuarioId === meuId)
                );
            }

        } catch {
            if (aba !== abaAtual) return;
            rankingLista.replaceChildren();
            const erro = document.createElement("p");
            erro.textContent = "Não foi possível carregar o ranking.";
            rankingLista.appendChild(erro);
        }
    }

    // O ranking fica sempre embaixo das regras.
    function mostrarRankingAbaixo() {
        if (!painelRanking) return;
        painelRanking.hidden = false;
        carregarRanking();
    }

    if (painelRanking) {
        abaSolo.addEventListener("click", () => { abaAtual = "solo"; carregarRanking(); });
        abaDuelos.addEventListener("click", () => { abaAtual = "duelos"; carregarRanking(); });

        // Começou o solo: o ranking sai da frente
        botaoSolo.addEventListener("click", () => { painelRanking.hidden = true; });
    }

    // ==============================
    // BOTÕES
    // ==============================

    botaoConvidar.addEventListener("click", convidar);
    botaoCancelar.addEventListener("click", cancelar);

    botaoFinalConvidar.addEventListener("click", convidar);

    botaoFinalSolo.addEventListener("click", () => {
        final.hidden = true;
        area.hidden = true;
        botaoSolo.click();
    });

    botaoFinalVoltar.addEventListener("click", () => {
        final.hidden = true;
        botaoVoltar.click();
    });

    // Abrir a tela da memória pelo menu: começa sempre nas regras
    botaoAbrir.addEventListener("click", () => {
        parar();
        mostrarRankingAbaixo();
        area.hidden = true;
        final.hidden = true;
    });

    // Avisa o servidor que saiu (funciona até com o app fechando)
    function avisarSaida() {
        if (!codigo || !estado) return;
        if (estado.status !== "aguardando" && estado.status !== "jogando") return;

        const corpo = JSON.stringify({ initData: telegram?.initData || "", codigo });

        try {
            const enviou = navigator.sendBeacon?.(
                "/api/memoria-duelo/desistir",
                new Blob([corpo], { type: "application/json" })
            );
            if (!enviou) {
                fetch("/api/memoria-duelo/desistir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: corpo,
                    keepalive: true
                }).catch(() => {});
            }
        } catch {}
    }

    // Sair da tela: esperando = cancela o convite; jogando = desiste (o outro vence)
    botaoVoltar.addEventListener("click", () => {
        avisarSaida();
        parar();
        codigo = null;
        area.hidden = true;
        final.hidden = true;
    });

    window.addEventListener("pagehide", () => {
        if (ativo) avisarSaida();
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && ativo) buscarEstado();
    });

    // ==============================
    // LINK DO CONVITE (startapp=duelo_CODIGO)
    // ==============================

    const parametro = telegram?.initDataUnsafe?.start_param || "";

    if (parametro.startsWith("duelo_")) {
        const cod = parametro.slice("duelo_".length);
        const inicio = Date.now();

        // Espera o app terminar a verificação de acesso
        const vigia = setInterval(() => {
            if (telaAcesso && telaAcesso.hidden) {
                clearInterval(vigia);
                entrarPeloLink(cod);
            } else if (Date.now() - inicio > 20000) {
                clearInterval(vigia);
            }
        }, 200);
    }
})();
