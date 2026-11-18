// ==============================
// JOGO DA VELHA
// Sozinho: contra o bot (só no celular).
// 2 jogadores: convite no grupo, melhor de 3 (servidor é o juiz).
// ==============================

(function () {
    const el = id => document.getElementById(id);

    const telaAcesso = el("tela-acesso");
    const telaHabilidade = el("tela-habilidade");
    const tela = el("tela-velha");
    const botaoAbrir = el("abrir-velha");
    const botaoVoltar = el("voltar-menu-velha");

    const inicio = el("velha-inicio");
    const mensagem = el("velha-mensagem");
    const placarBotTexto = el("velha-placar-bot");
    const botaoConvidar = el("velha-duelo-convidar");
    const rankingLista = el("velha-ranking-lista");

    const espera = el("velha-espera");
    const esperaTempo = el("velha-espera-tempo");
    const botaoCancelar = el("velha-cancelar");

    const jogo = el("velha-jogo");
    const caixaJ1 = el("velha-j1");
    const caixaJ2 = el("velha-j2");
    const tempoArea = el("velha-tempo");
    const barra = el("velha-barra");
    const aviso = el("velha-aviso");
    const tabuleiroEl = el("velha-tabuleiro");
    const botoesBot = el("velha-botoes-bot");
    const botaoDeNovo = el("velha-de-novo");
    const botaoTrocar = el("velha-trocar");

    const final = el("velha-final");
    const finalIcone = el("velha-final-icone");
    const finalTitulo = el("velha-final-titulo");
    const finalSub = el("velha-final-sub");
    const finalPlacar = el("velha-final-placar");
    const botaoFinalConvidar = el("velha-final-convidar");
    const botaoFinalBot = el("velha-final-bot");
    const botaoFinalVoltar = el("velha-final-voltar");

    if (!tela || !botaoAbrir || !tabuleiroEl || !final) {
        console.error("Elementos do Jogo da Velha não encontrados.");
        return;
    }

    const telegram = window.Telegram?.WebApp;

    const LINHAS = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    const NOMES_NIVEL = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
    const ACERTO_BOT = { facil: 0.25, medio: 0.65, dificil: 0.9 };

    let modo = null;         // "bot" ou "duelo"

    function vibrar(tipo) {
        try { telegram?.HapticFeedback?.notificationOccurred(tipo); } catch {}
    }

    // ==============================
    // TABULEIRO (desenho)
    // ==============================

    (function criarTabuleiro() {
        tabuleiroEl.replaceChildren();
        for (let i = 0; i < 9; i++) {
            const casa = document.createElement("button");
            casa.type = "button";
            casa.className = "velha-casa";
            casa.dataset.casa = String(i);
            casa.addEventListener("click", () => tocarCasa(i));
            tabuleiroEl.appendChild(casa);
        }
    })();

    function desenharTabuleiro(tab, { linha = null, podeJogar = false } = {}) {
        tabuleiroEl.querySelectorAll(".velha-casa").forEach((casa, i) => {
            const valor = tab[i];
            casa.textContent = valor === "X" ? "✕" : valor === "O" ? "◯" : "";
            casa.classList.toggle("velha-x", valor === "X");
            casa.classList.toggle("velha-o", valor === "O");
            casa.classList.toggle("velha-vence", Boolean(linha && linha.includes(i)));
            casa.disabled = !podeJogar || valor !== ".";
        });

        tabuleiroEl.classList.toggle("velha-bloqueado", !podeJogar);
    }

    function verificar(tab) {
        for (const linha of LINHAS) {
            const [a, b, c] = linha;
            if (tab[a] !== "." && tab[a] === tab[b] && tab[a] === tab[c]) {
                return { vencedor: tab[a], linha };
            }
        }
        if (!tab.includes(".")) return { vencedor: "empate", linha: null };
        return null;
    }

    function desenharCaixas(j1, j2, vez) {
        [[caixaJ1, j1, 1], [caixaJ2, j2, 2]].forEach(([caixa, j, numero]) => {
            caixa.querySelector(".md-nome").textContent = j.nome;
            caixa.querySelector(".md-pontos").textContent = String(j.pontos);
            caixa.classList.toggle("md-vez", vez === numero);
        });
    }

    // ==============================
    // TELAS
    // ==============================

    function abrirTela() {
        document.querySelectorAll("main > .tela").forEach(t => { t.hidden = true; });
        tela.hidden = false;
        mostrarInicio();
    }

    function mostrarInicio(texto = "") {
        pararDuelo();
        modo = null;
        inicio.hidden = false;
        espera.hidden = true;
        jogo.hidden = true;
        final.hidden = true;
        mensagem.textContent = texto;
        atualizarPlacarBotTexto();
        carregarRanking();
    }

    function mostrarJogo() {
        inicio.hidden = true;
        espera.hidden = true;
        final.hidden = true;
        jogo.hidden = false;
    }

    // Avisa o servidor que saiu (funciona até com o app fechando)
    function avisarSaida() {
        const e = duelo.estado;
        if (!duelo.codigo || !e) return;
        if (e.status !== "aguardando" && e.status !== "jogando") return;

        const corpo = JSON.stringify({
            initData: telegram?.initData || "",
            codigo: duelo.codigo
        });

        try {
            const enviou = navigator.sendBeacon?.(
                "/api/velha/desistir",
                new Blob([corpo], { type: "application/json" })
            );
            if (!enviou) {
                fetch("/api/velha/desistir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: corpo,
                    keepalive: true
                }).catch(() => {});
            }
        } catch {}
    }

    window.addEventListener("pagehide", () => {
        if (duelo.ativo) avisarSaida();
    });

    // Sair da tela: esperando = cancela o convite; jogando = desiste (o outro vence)
    function sair() {
        if (modo === "duelo") {
            avisarSaida();
            duelo.codigo = null;
        }
        pararDuelo();
        modo = null;
        tela.hidden = true;
        final.hidden = true;
        if (telaHabilidade) telaHabilidade.hidden = false;
    }

    // ==============================
    // CONTRA O BOT
    // ==============================

    const bot = {
        nivel: "medio",
        tab: ".........".split(""),
        euComeco: false,   // vira true na 1ª partida: você começa
        vezDoBot: false,
        terminado: false
    };

    function lerPlacarBot() {
        try {
            return JSON.parse(localStorage.getItem("velha_placar_bot") || "{}");
        } catch {
            return {};
        }
    }

    function salvarPlacarBot(placar) {
        try { localStorage.setItem("velha_placar_bot", JSON.stringify(placar)); } catch {}
    }

    function placarDoNivel(nivel) {
        const p = lerPlacarBot()[nivel] || {};
        return { v: p.v || 0, d: p.d || 0, e: p.e || 0 };
    }

    function atualizarPlacarBotTexto() {
        const partes = Object.keys(NOMES_NIVEL).map(n => {
            const p = placarDoNivel(n);
            return `${NOMES_NIVEL[n]}: ${p.v}V ${p.d}D ${p.e}E`;
        });
        placarBotTexto.textContent = "Seu placar contra o bot · " + partes.join(" · ");
    }

    function minimax(tab, jogador) {
        const fim = verificar(tab);
        if (fim) {
            if (fim.vencedor === "O") return { pontos: 10 };
            if (fim.vencedor === "X") return { pontos: -10 };
            return { pontos: 0 };
        }

        let melhor = { pontos: jogador === "O" ? -Infinity : Infinity, casa: null };

        for (let i = 0; i < 9; i++) {
            if (tab[i] !== ".") continue;
            tab[i] = jogador;
            const r = minimax(tab, jogador === "O" ? "X" : "O");
            tab[i] = ".";
            const pontos = r.pontos - Math.sign(r.pontos); // vence mais rápido

            if (
                (jogador === "O" && pontos > melhor.pontos) ||
                (jogador === "X" && pontos < melhor.pontos)
            ) {
                melhor = { pontos, casa: i };
            }
        }

        return melhor;
    }

    function jogadaDoBot() {
        const livres = bot.tab.map((v, i) => (v === "." ? i : null)).filter(i => i !== null);

        if (Math.random() < ACERTO_BOT[bot.nivel]) {
            const r = minimax([...bot.tab], "O");
            if (r.casa !== null) return r.casa;
        }

        return livres[Math.floor(Math.random() * livres.length)];
    }

    function desenharBot(linha = null) {
        const p = placarDoNivel(bot.nivel);
        desenharCaixas(
            { nome: "Você ✕", pontos: p.v },
            { nome: `Bot ${NOMES_NIVEL[bot.nivel]} ◯`, pontos: p.d },
            bot.terminado ? null : bot.vezDoBot ? 2 : 1
        );
        desenharTabuleiro(bot.tab, {
            linha,
            podeJogar: !bot.terminado && !bot.vezDoBot
        });
    }

    function comecarBot(nivel) {
        if (nivel) bot.nivel = nivel;
        modo = "bot";
        bot.tab = ".........".split("");
        bot.terminado = false;
        bot.euComeco = !bot.euComeco;   // alterna quem começa
        bot.vezDoBot = !bot.euComeco;

        tempoArea.hidden = true;
        botoesBot.hidden = true;
        mostrarJogo();

        aviso.textContent = bot.euComeco ? "Você começa!" : "O bot começa.";
        aviso.classList.remove("md-aviso-minha");
        desenharBot();

        if (bot.vezDoBot) setTimeout(vezDoBot, 700);
    }

    function vezDoBot() {
        if (modo !== "bot" || bot.terminado) return;
        bot.tab[jogadaDoBot()] = "O";
        bot.vezDoBot = false;
        if (!fimBot()) {
            aviso.textContent = "Sua vez!";
            desenharBot();
        }
    }

    function fimBot() {
        const fim = verificar(bot.tab);
        if (!fim) return false;

        bot.terminado = true;
        const placar = lerPlacarBot();
        const p = placarDoNivel(bot.nivel);

        if (fim.vencedor === "X") {
            p.v++;
            aviso.textContent = "Você venceu! 🎉";
            vibrar("success");
        } else if (fim.vencedor === "O") {
            p.d++;
            aviso.textContent = "O bot venceu.";
            vibrar("error");
        } else {
            p.e++;
            aviso.textContent = "Deu velha! Empate.";
        }

        placar[bot.nivel] = p;
        salvarPlacarBot(placar);

        desenharBot(fim.linha);
        botoesBot.hidden = false;
        return true;
    }

    // ==============================
    // DUELO
    // ==============================

    const duelo = {
        codigo: null,
        estado: null,
        recebidoEm: 0,
        timerEstado: null,
        timerRelogio: null,
        enviando: false,
        ativo: false
    };

    async function chamar(rota, extras = {}) {
        const resposta = await fetch(`/api/velha/${rota}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: telegram?.initData || "", ...extras })
        });

        let dados = {};
        try { dados = await resposta.json(); } catch {}
        return { ok: resposta.ok, dados };
    }

    function pararDuelo() {
        duelo.ativo = false;
        clearTimeout(duelo.timerEstado);
        clearInterval(duelo.timerRelogio);
    }

    async function convidar() {
        if (duelo.enviando) return;
        duelo.enviando = true;
        botaoConvidar.disabled = true;
        botaoFinalConvidar.disabled = true;

        try {
            const { ok, dados } = await chamar("convidar");

            if (!ok) {
                if (dados.motivo === "aguarde") {
                    const s = Math.ceil((dados.esperarMs || 0) / 1000);
                    mostrarInicio(`Espere ${s} segundos para convidar de novo.`);
                } else if (dados.motivo === "em_partida" && dados.codigo) {
                    abrirPartida(dados.codigo);
                } else {
                    mostrarInicio(dados.erro || "Não foi possível convidar agora.");
                }
                return;
            }

            iniciarDuelo(dados);

        } catch {
            mostrarInicio("Sem conexão. Tente de novo.");
        } finally {
            duelo.enviando = false;
            botaoConvidar.disabled = false;
            botaoFinalConvidar.disabled = false;
        }
    }

    async function cancelarConvite(voltarAoInicio = true) {
        const cod = duelo.codigo;
        pararDuelo();
        duelo.codigo = null;
        if (voltarAoInicio) mostrarInicio("Convite cancelado.");
        if (cod) {
            try { await chamar("cancelar", { codigo: cod }); } catch {}
        }
    }

    async function entrarPeloLink(cod) {
        abrirTela();
        mensagem.textContent = "Entrando na partida...";

        try {
            const { ok, dados } = await chamar("entrar", { codigo: cod });

            if (!ok) {
                if (dados.motivo === "em_partida" && dados.codigo) {
                    abrirPartida(dados.codigo);
                    return;
                }
                mostrarInicio(
                    dados.erro ||
                    "Alguém já entrou, mas você pode jogar contra o bot ou convidar alguém também."
                );
                return;
            }

            iniciarDuelo(dados);

        } catch {
            mostrarInicio("Sem conexão. Tente de novo.");
        }
    }

    async function abrirPartida(cod) {
        try {
            const { ok, dados } = await chamar("estado", { codigo: cod });
            if (ok) iniciarDuelo(dados);
            else mostrarInicio(dados.erro || "Partida não encontrada.");
        } catch {
            mostrarInicio("Sem conexão. Tente de novo.");
        }
    }

    function iniciarDuelo(dados) {
        pararDuelo();
        modo = "duelo";
        duelo.ativo = true;
        duelo.codigo = dados.codigo;
        duelo.estado = null;
        receber(dados);

        duelo.timerRelogio = setInterval(relogio, 200);
        agendar();
    }

    function agendar() {
        clearTimeout(duelo.timerEstado);
        if (!duelo.ativo) return;
        duelo.timerEstado = setTimeout(buscarEstado, 1500);
    }

    async function buscarEstado() {
        if (!duelo.ativo || !duelo.codigo) return;
        if (document.hidden) { agendar(); return; }

        try {
            const { ok, dados } = await chamar("estado", { codigo: duelo.codigo });
            if (ok && duelo.ativo && dados.codigo === duelo.codigo) receber(dados);
        } catch {}

        agendar();
    }

    function nome(numero) {
        const j = duelo.estado?.jogadores?.[numero - 1];
        return j?.nome || "Jogador";
    }

    function receber(dados) {
        const anterior = duelo.estado;
        duelo.estado = dados;
        duelo.recebidoEm = Date.now();

        if (
            anterior && dados.seq !== anterior.seq &&
            dados.status === "jogando" && dados.vez === dados.eu &&
            anterior.vez !== dados.eu
        ) {
            vibrar("success");
        }

        if (dados.status === "aguardando") {
            inicio.hidden = true;
            jogo.hidden = true;
            final.hidden = true;
            espera.hidden = false;
            relogio();
            return;
        }

        if (dados.status === "jogando" || dados.status === "finalizada") {
            mostrarJogo();
            tempoArea.hidden = false;
            botoesBot.hidden = true;
            desenharDuelo();
            relogio();

            if (dados.status === "finalizada") {
                pararDuelo();
                setTimeout(() => mostrarFinal(dados), 1600);
            }
            return;
        }

        pararDuelo();
        duelo.codigo = null;
        mostrarInicio(
            dados.status === "expirada"
                ? "Ninguém entrou a tempo. Jogue contra o bot ou convide de novo."
                : "Convite cancelado."
        );
    }

    function mostrandoFimRodada() {
        const e = duelo.estado;
        if (!e || e.ultima?.tipo !== "rodada") return false;
        if (e.status === "finalizada") return true;
        const passou = Date.now() - duelo.recebidoEm;
        return e.vezComecaEmMs - passou > 0;
    }

    function desenharDuelo() {
        const e = duelo.estado;
        if (!e) return;

        const [j1, j2] = e.jogadores;
        desenharCaixas(
            { nome: `${j1.nome || "Jogador"} ✕${e.eu === 1 ? " (você)" : ""}`, pontos: j1.vitorias },
            { nome: `${j2.nome || "Jogador"} ◯${e.eu === 2 ? " (você)" : ""}`, pontos: j2.vitorias },
            e.status === "jogando" ? e.vez : null
        );

        if (mostrandoFimRodada()) {
            desenharTabuleiro(e.ultima.tabuleiro, { linha: e.ultima.linha });
            return;
        }

        const passou = Date.now() - duelo.recebidoEm;
        const podeJogar =
            e.status === "jogando" && e.vez === e.eu &&
            e.vezComecaEmMs - passou <= 0 && !duelo.enviando;

        desenharTabuleiro(e.tabuleiro, { podeJogar });
    }

    function relogio() {
        const e = duelo.estado;
        if (!e || modo !== "duelo") return;

        const passou = Date.now() - duelo.recebidoEm;

        if (e.status === "aguardando") {
            const resta = Math.max(0, e.expiraEm - Date.now());
            esperaTempo.textContent =
                `O convite some em ${Math.floor(resta / 60000)}:` +
                `${String(Math.floor((resta % 60000) / 1000)).padStart(2, "0")}`;
            return;
        }

        if (e.status !== "jogando") {
            if (e.ultima?.tipo === "rodada") {
                aviso.textContent = e.ultima.vencedor === 0
                    ? "Deu velha na última rodada!"
                    : `${nome(e.ultima.vencedor)} venceu a rodada!`;
            }
            return;
        }

        const comecaEm = Math.max(0, e.vezComecaEmMs - passou);
        const resta = Math.max(0, e.vezRestanteMs - passou);
        const fracao = Math.min(1, resta / e.tempoVezMs);

        barra.style.width = `${(fracao * 100).toFixed(1)}%`;
        barra.classList.toggle("md-pouco", fracao < 0.3);

        const minhaVez = e.vez === e.eu;
        const seg = Math.ceil(resta / 1000);

        if (comecaEm > 0 && e.ultima?.tipo === "rodada") {
            aviso.textContent = e.ultima.vencedor === 0
                ? `Deu velha! Rodada ${e.rodada} já vai começar...`
                : `${nome(e.ultima.vencedor)} venceu a rodada! Próxima já vai começar...`;
        } else if (comecaEm > 0) {
            aviso.textContent = minhaVez ? "Você começa! Prepare-se..." : `${nome(e.vez)} começa...`;
        } else if (e.ultima?.tipo === "tempo" && passou < 2500) {
            aviso.textContent = "O tempo acabou e a vez passou.";
        } else if (minhaVez) {
            aviso.textContent = `SUA VEZ! ${seg}s · Rodada ${e.rodada}`;
        } else {
            aviso.textContent = `Vez de ${nome(e.vez)} (${seg}s) · Rodada ${e.rodada}`;
        }

        aviso.classList.toggle("md-aviso-minha", minhaVez && comecaEm === 0);

        // Atualiza o tabuleiro quando a pausa entre rodadas acaba
        if (!duelo.enviando) desenharDuelo();
    }

    async function jogarDuelo(casa) {
        const e = duelo.estado;
        if (!e || e.status !== "jogando" || e.vez !== e.eu || duelo.enviando) return;

        duelo.enviando = true;

        // mostra a jogada na hora, o servidor confirma em seguida
        const tab = e.tabuleiro.split("");
        tab[casa] = e.eu === 1 ? "X" : "O";
        desenharTabuleiro(tab.join(""), {});

        try {
            const { ok, dados } = await chamar("jogada", { codigo: duelo.codigo, casa });
            duelo.enviando = false;
            if (ok) receber(dados);
            else {
                desenharDuelo();
                if (dados.erro) aviso.textContent = dados.erro;
            }
        } catch {
            duelo.enviando = false;
            desenharDuelo();
        }
    }

    // ==============================
    // TELA FINAL DO DUELO
    // ==============================

    function mostrarFinal(dados) {
        const eu = dados.eu;
        const venci = dados.vencedor === eu;
        const empate = dados.vencedor === 0;

        final.classList.remove("md-final-vitoria", "md-final-derrota", "md-final-empate");

        if (empate) {
            final.classList.add("md-final-empate");
            finalIcone.textContent = "🤝";
            finalTitulo.textContent = "EMPATE!";
            finalSub.textContent = "Ninguém levou a melhor. Revanche?";
        } else if (venci) {
            final.classList.add("md-final-vitoria");
            finalIcone.textContent = "🏆";
            finalTitulo.textContent = "VOCÊ VENCEU!";
            finalSub.textContent = dados.motivoFim === "abandono"
                ? `${nome(eu === 1 ? 2 : 1)} saiu da partida.`
                : "Estratégia de campeão!";
            vibrar("success");
        } else {
            final.classList.add("md-final-derrota");
            finalIcone.textContent = "🥈";
            finalTitulo.textContent = `${nome(dados.vencedor).toUpperCase()} VENCEU`;
            finalSub.textContent = dados.motivoFim === "abandono"
                ? "Você perdeu a vez 3 vezes seguidas."
                : "Foi por pouco! Chame para a revanche.";
        }

        finalPlacar.replaceChildren();

        const ordem = [...dados.jogadores].sort((a, b) => b.vitorias - a.vitorias);

        for (const j of ordem) {
            const linha = document.createElement("div");
            linha.className = `md-final-linha md-cor-${j.numero}`;
            if (dados.vencedor === j.numero) linha.classList.add("md-final-ganhou");

            const n = document.createElement("span");
            n.textContent =
                (dados.vencedor === j.numero ? "👑 " : "") +
                (j.nome || "Jogador") +
                (j.numero === eu ? " (você)" : "");

            const v = document.createElement("strong");
            v.textContent = `${j.vitorias} ${j.vitorias === 1 ? "rodada" : "rodadas"}`;

            linha.append(n, v);
            finalPlacar.appendChild(linha);
        }

        if (dados.empates) {
            const e = document.createElement("p");
            e.className = "md-final-sub";
            e.textContent = `${dados.empates} ${dados.empates === 1 ? "rodada deu" : "rodadas deram"} velha.`;
            finalPlacar.appendChild(e);
        }

        final.querySelectorAll(".md-confete").forEach(c => c.remove());
        const cores = ["#ffd166", "#06d6a0", "#4cc9f0", "#f72585", "#9b5de5", "#ff6b6b"];
        const qtd = venci || empate ? 40 : 12;
        for (let i = 0; i < qtd; i++) {
            const c = document.createElement("i");
            c.className = "md-confete";
            c.style.left = `${(i * 37 + 7) % 100}%`;
            c.style.background = cores[i % cores.length];
            c.style.animationDelay = `${(i % 10) * 0.25}s`;
            c.style.animationDuration = `${2.6 + (i % 4) * 0.5}s`;
            final.appendChild(c);
        }

        jogo.hidden = true;
        final.hidden = false;
        duelo.codigo = null;
        modo = null;
    }

    // ==============================
    // RANKING DE DUELOS
    // ==============================

    async function carregarRanking() {
        rankingLista.replaceChildren();
        const carregando = document.createElement("p");
        carregando.textContent = "Carregando...";
        rankingLista.appendChild(carregando);

        const meuId = String(telegram?.initDataUnsafe?.user?.id || "");

        try {
            const { ok, dados } = await chamar("ranking");
            if (!ok) throw new Error();

            rankingLista.replaceChildren();
            const lista = dados.ranking || [];

            if (!lista.length) {
                const vazio = document.createElement("p");
                vazio.textContent = "Ninguém no ranking ainda. Convide alguém e seja o primeiro!";
                rankingLista.appendChild(vazio);
                return;
            }

            for (const item of lista) {
                const linha = document.createElement("div");
                linha.className = "md-rank-linha" + (item.usuarioId === meuId ? " md-rank-eu" : "");

                const pos = document.createElement("span");
                pos.className = "md-rank-pos";
                pos.textContent = item.posicao === 1 ? "🥇" : item.posicao === 2 ? "🥈"
                    : item.posicao === 3 ? "🥉" : `${item.posicao}º`;

                const n = document.createElement("span");
                n.className = "md-rank-nome";
                n.textContent = item.nome || "Jogador";

                const v = document.createElement("strong");
                v.textContent = `${item.vitorias} V · ${item.rodadas} rod.`;

                linha.append(pos, n, v);
                rankingLista.appendChild(linha);
            }
        } catch {
            rankingLista.replaceChildren();
            const erro = document.createElement("p");
            erro.textContent = "Não foi possível carregar o ranking.";
            rankingLista.appendChild(erro);
        }
    }

    // ==============================
    // TOQUES
    // ==============================

    function tocarCasa(casa) {
        if (modo === "bot") {
            if (bot.terminado || bot.vezDoBot || bot.tab[casa] !== ".") return;
            bot.tab[casa] = "X";
            if (fimBot()) return;
            bot.vezDoBot = true;
            aviso.textContent = "O bot está pensando...";
            desenharBot();
            setTimeout(vezDoBot, 550);
            return;
        }

        if (modo === "duelo") jogarDuelo(casa);
    }

    tela.querySelectorAll(".velha-nivel").forEach(botao => {
        botao.addEventListener("click", () => comecarBot(botao.dataset.nivel));
    });

    botaoAbrir.addEventListener("click", abrirTela);
    botaoVoltar.addEventListener("click", sair);
    botaoConvidar.addEventListener("click", convidar);
    botaoCancelar.addEventListener("click", () => cancelarConvite(true));
    botaoDeNovo.addEventListener("click", () => comecarBot());
    botaoTrocar.addEventListener("click", () => mostrarInicio());
    botaoFinalConvidar.addEventListener("click", convidar);
    botaoFinalBot.addEventListener("click", () => mostrarInicio());
    botaoFinalVoltar.addEventListener("click", sair);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && duelo.ativo) buscarEstado();
    });

    // ==============================
    // LINK DO CONVITE (startapp=velha_CODIGO)
    // ==============================

    const parametro = telegram?.initDataUnsafe?.start_param || "";

    if (parametro.startsWith("velha_")) {
        const cod = parametro.slice("velha_".length);
        const comecou = Date.now();

        const vigia = setInterval(() => {
            if (telaAcesso && telaAcesso.hidden) {
                clearInterval(vigia);
                entrarPeloLink(cod);
            } else if (Date.now() - comecou > 20000) {
                clearInterval(vigia);
            }
        }, 200);
    }
})();
