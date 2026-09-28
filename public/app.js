
const telaAcesso =
    document.getElementById(
        "tela-acesso"
    );

const statusAcesso =
    document.getElementById(
        "status-acesso"
    ); const telaMenu =

        document.getElementById(
            "tela-menu"
        );

const telaModos =
    document.getElementById(
        "tela-modos"
    );

const botaoModoSorte =
    document.getElementById(
        "modo-sorte"
    );


const telaRoleta =
    document.getElementById(
        "tela-roleta"
    );

const telaPontos =
    document.getElementById(
        "tela-pontos"
    );

const telaComoGanhar =
    document.getElementById(
        "tela-como-ganhar"
    );

const telaBau =
    document.getElementById(
        "tela-bau"
    );


const botaoAbrirBau =
    document.getElementById(
        "abrir-bau"
    );


const statusBauMenu =
    document.getElementById(
        "status-bau-menu"
    );


const botaoVoltarMenuBau =
    document.getElementById(
        "voltar-menu-bau"
    );


const resultadoBau =
    document.getElementById(
        "resultado-bau"
    );


const botoesBau =
    Array.from(
        document.querySelectorAll(
            ".bau-opcao"
        )
    );

const botaoAbrirComoGanhar =
    document.getElementById(
        "abrir-como-ganhar"
    );

const botaoVoltarMenuComoGanhar =
    document.getElementById(
        "voltar-menu-como-ganhar"
    );

const telaRanking =
    document.getElementById(
        "tela-ranking"
    );

const botaoAbrirRanking =
    document.getElementById(
        "abrir-ranking"
    );

const botaoVoltarMenuRanking =
    document.getElementById(
        "voltar-menu-ranking"
    );

const botaoVoltarMenuRankingFlutuante =
    document.getElementById(
        "voltar-menu-ranking-flutuante"
    );

const rankingLista =
    document.getElementById(
        "ranking-lista"
    );

const minhaPosicaoRanking =
    document.getElementById(
        "minha-posicao-ranking"
    );

const botaoAbrirPontos =
    document.getElementById(
        "abrir-pontos"
    );

const botaoVoltarMenuPontos =
    document.getElementById(
        "voltar-menu-pontos"
    );

const canvasPontos =
    document.getElementById(
        "roleta-pontos"
    );

const ctxPontos =
    canvasPontos.getContext(
        "2d"
    );

const botaoGirarPontos =
    document.getElementById(
        "girar-pontos"
    );

const totalPontosElemento =
    document.getElementById(
        "total-pontos"
    );

const resultadoPontos =
    document.getElementById(
        "resultado-pontos"
    );

const historicoPontosLista =
    document.getElementById(
        "historico-pontos-lista"
    );


const historicoPremiadaLista =
    document.getElementById(
        "historico-premiada-lista"
    );

const botaoAbrirRoleta =
    document.getElementById(
        "abrir-roleta"
    );

const botaoVoltarMenu =
    document.getElementById(
        "voltar-menu"
    );

const statusRoletaMenu =
    document.getElementById(
        "status-roleta-menu"
    );

const canvas = document.getElementById("roleta");

const ctx =
    canvas.getContext("2d");

const telegram = window.Telegram?.WebApp;

if (telegram) {
    telegram.ready();
    telegram.expand();
}

const initData = telegram?.initData || "";

const botaoGirar = document.getElementById("girar");
const resultado = document.getElementById("resultado");

const avisoComunidade =
    document.getElementById(
        "aviso-comunidade"
    );

const canaisFaltandoElemento =
    document.getElementById(
        "canais-faltando"
    );

const botaoVerificarInscricao =
    document.getElementById(
        "verificar-inscricao"
    );

let itens = [
    "R$ 50",
    "💎",
    "QUASE",
    "R$ 5",
    "💎",
    "R$ 5",
    "R$ 12",
    "💎",
    "R$ 7",
    "💎",
    "R$ 5",
    "R$ 10",
    "💎"
];

const itensPontosPrimeiroGiro = [
    {
        tipo: "multiplicador",
        valor: 1.5,
        texto: "1.5x"
    },

    { tipo: "pontos", valor: 325 },
    { tipo: "diamante", valor: 1000 },
    { tipo: "pontos", valor: 500 },
    { tipo: "pontos", valor: 300 },
    { tipo: "pontos", valor: 700 },

    {
        tipo: "multiplicador",
        valor: 1.6,
        texto: "1.6x"
    },

    { tipo: "pontos", valor: 500 },
    { tipo: "roleta" },
    { tipo: "pontos", valor: 425 },
    { tipo: "pontos", valor: 700 },
    { tipo: "pontos", valor: 300 }
];


const itensPontosSegundoGiro = [
    { tipo: "pontos", valor: 325 },
    { tipo: "diamante", valor: 1000 },
    { tipo: "pontos", valor: 500 },
    { tipo: "pontos", valor: 300 },
    { tipo: "pontos", valor: 700 },
    { tipo: "pontos", valor: 500 },
    { tipo: "roleta" },
    { tipo: "pontos", valor: 425 },
    { tipo: "pontos", valor: 700 },
    { tipo: "pontos", valor: 300 }
];


let itensPontosAtuais =
    itensPontosPrimeiroGiro;

const coresPontos = [
    "#ff6b6b", // vermelho coral
    "#ffd166", // amarelo
    "#06d6a0", // verde água
    "#4cc9f0", // azul claro
    "#f72585", // rosa forte
    "#f77f00", // laranja
    "#90be6d", // verde
    "#577590", // azul petróleo
    "#9b5de5", // roxo
    "#43aa8b", // verde médio
    "#f94144", // vermelho vivo
    "#f9c74f"  // dourado
];

const coresBase = [
    ["#245a94", "#133658"],
    ["#d94a57", "#8c2430"]
];

const quantidade = itens.length;

const anguloPorItem =
    (Math.PI * 2) / quantidade;

let rotacaoAtual = 0;
let rotacaoPontosAtual = 0;

let versaoRodada = null;
let rodadaAberta = false;
let rodadaUtilizada = false;
let verificandoEstado = false;

let usuarioAtual = null;
let carregandoUsuario = false;
let girandoPontos = false;
let abrindoBau = false;

let girandoPremiada = false;

let itensPremiadaPendentes =
    null;

botaoGirar.disabled = true;
botaoGirar.textContent =
    "⏳ CARREGANDO...";

const logoCentro = new Image();
logoCentro.src = "logo-centro.png";
logoCentro.onload = () => desenharRoleta();

async function verificarAcesso() {

    try {

        const resposta =
            await fetch(
                "/api/verificar-acesso",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        initData
                    })
                }
            );

        const dados =
            await resposta.json();
        if (
            !resposta.ok ||
            !dados.permitido
        ) {
            telaMenu.hidden = true;
            telaRoleta.hidden = true;

            statusAcesso.textContent =
                "⛔ Hmm, Parece que essa conta é muito recente... Aguarde um tempo";
            return false;
        }

        telaAcesso.hidden = true;
        telaModos.hidden = false;
        return true;

    } catch (erro) {
        telaMenu.hidden = true;
        statusAcesso.textContent =
            "❌ Não foi possível verificar o acesso agora.";
        return false;
    }
}

// ========================================
// CARREGAR USUÁRIO DA MINI APP
// ========================================

function atualizarTelaPontos(
    usuario
) {

    if (!usuario) {
        return;
    }


    usuarioAtual =
        usuario;


    const pontos =
        Number(
            usuario.pontos || 0
        );


    const girosExtras =
        Math.max(
            0,
            Number(
                usuario.girosPontosExtras ||
                0
            )
        );


    totalPontosElemento.textContent =
        `${pontos.toLocaleString("pt-BR")} pts`;


    atualizarTelaBau(
        usuario
    );


    if (girandoPontos) {
        return;
    }


    if (
        usuario.giroDiarioDisponivel
    ) {

        botaoGirarPontos.disabled =
            false;

        botaoGirarPontos.textContent =
            "🎡 GIRAR";

        return;
    }


    if (
        girosExtras > 0
    ) {

        botaoGirarPontos.disabled =
            false;

        botaoGirarPontos.textContent =
            "🎁 USAR GIRO EXTRA";

        return;
    }


    botaoGirarPontos.disabled =
        true;

    botaoGirarPontos.textContent =
        "🔒 PRÓXIMO GIRO ÀS 08:30";
}


function atualizarTelaBau(
    usuario
) {

    const estado =
        usuario.bauSegundaChance ||
        {};


    if (
        estado.disponivel === true
    ) {

        botaoAbrirBau.disabled =
            false;

        botaoAbrirBau.classList.remove(
            "card-bloqueado"
        );

        statusBauMenu.textContent =
            "🎁 DISPONÍVEL AGORA";

        return;
    }


    botaoAbrirBau.disabled =
        true;

    botaoAbrirBau.classList.add(
        "card-bloqueado"
    );


    if (
        estado.usadoHoje === true
    ) {

        statusBauMenu.textContent =
            "✅ BAÚ USADO HOJE";

    } else {

        statusBauMenu.textContent =
            "🔒 GIRE A ROLETA DE PONTOS PRIMEIRO";
    }
}

// ========================================
// ATUALIZAR FATIAS DA ROLETA PREMIADA
// ========================================

function aplicarItensPremiada(
    novosItens,
    forcar = false
) {
    if (
        !Array.isArray(
            novosItens
        ) ||
        novosItens.length !==
        quantidade
    ) {
        return;
    }

    const normalizados =
        novosItens.map(
            item =>
                String(item)
        );

    if (
        girandoPremiada &&
        !forcar
    ) {

        itensPremiadaPendentes =
            normalizados;
        return;
    }

    const mudou =
        normalizados.some(
            (
                item,
                indice
            ) =>
                item !==
                itens[indice]
        );

    if (!mudou) {
        return;
    }

    itens =
        normalizados;

    desenharRoleta();
}

// ========================================
// ESTADO DA ROLETA PREMIADA
// ========================================

function atualizarTelaPremiada(
    usuario
) {
    if (
        !usuario ||
        !usuario.roletaPremiada
    ) {
        return;
    }

    const estado =
        usuario.roletaPremiada;

    aplicarItensPremiada(
        estado.itens
    );

    rodadaAberta =
        estado.rodadaAberta ===
        true;

    rodadaUtilizada =
        estado.giroNormalUtilizado ===
        true;

    // ========================================
    // EXISTE NORMAL OU BÔNUS
    // ========================================

    if (estado.podeGirar) {

        botaoGirar.disabled =
            false;

        botaoGirar.textContent =
            "🎡 GIRAR";

        return;
    }

    // ========================================
    // ESTOQUE NORMAL ESGOTADO
    // E NÃO POSSUI BÔNUS
    // ========================================

    if (
        estado.premiosNormaisEsgotados
    ) {
        botaoGirar.disabled =
            true;
        botaoGirar.textContent =
            "🎁 PRÊMIOS ESGOTADOS";
        resultado.textContent =
            "🎁 Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀";
        return;
    }

    // ========================================
    // SUA RODADA AINDA NÃO FOI ABERTA
    // E NÃO POSSUI BÔNUS
    // ========================================

    if (
        !estado.rodadaAberta
    ) {
        botaoGirar.disabled =
            true;
        botaoGirar.textContent =
            "🔒 GANHE GIROS NA ROLETA DE PONTOS";
        return;
    }

    // ========================================
    // NORMAL JÁ USADO E SEM BÔNUS
    // ========================================

    botaoGirar.disabled =
        true;
    botaoGirar.textContent =
        "🔒 CHANCE ESGOTADA";
}

async function carregarUsuario() {

    if (carregandoUsuario) {
        return usuarioAtual;
    }

    carregandoUsuario = true;

    try {
        const resposta =
            await fetch(
                "/api/usuario",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            initData
                        })
                }
            );

        const dados =
            await resposta.json();

        if (
            !resposta.ok ||
            !dados.usuario
        ) {
            throw new Error(
                dados.erro ||
                "Usuário não disponível"
            );
        }

        atualizarTelaPontos(
            dados.usuario
        );

        atualizarTelaPremiada(
            dados.usuario
        );

        return dados.usuario;

    } catch (erro) {

        console.error(
            "❌ Erro ao carregar usuário:",
            erro
        );

        botaoGirarPontos.disabled =
            true;

        botaoGirarPontos.textContent =
            "❌ INDISPONÍVEL";

        return null;

    } finally {
        carregandoUsuario =
            false;
    }
}

// ========================================
// RANKING
// ========================================

function textoPosicaoRanking(
    posicao
) {
    const numero =
        Number(posicao);

    if (numero === 1) {
        return "🥇";
    }

    if (numero === 2) {
        return "🥈";
    }

    if (numero === 3) {
        return "🥉";
    }

    return `${numero}º`;
}

function criarLinhaRanking(
    item,
    destaque = false
) {
    const linha =
        document.createElement(
            "div"
        );
    const classes = [
        "ranking-linha"
    ];

    if (destaque) {
        classes.push(
            "ranking-eu"
        );
    }

    if (
        Number(
            item.posicao
        ) <= 10
    ) {
        classes.push(
            "ranking-ganhador-pontos"
        );
    }

    linha.className =
        classes.join(" ");

    const posicaoWrap =
        document.createElement("div");

    posicaoWrap.className =
        "ranking-posicao-wrap";

    const iconeMovimento =
        document.createElement("img");

    iconeMovimento.className =
        "ranking-movimento";

    let srcMovimento =
        "/icons/mantem.png";

    let altMovimento =
        "manteve posição";

    if (item.movimento === "subiu") {
        srcMovimento =
            "/icons/sobe.png";
        altMovimento =
            "subiu no ranking";
    } else if (
        item.movimento === "desceu"
    ) {
        srcMovimento =
            "/icons/desce.png";
        altMovimento =
            "desceu no ranking";
    }

    iconeMovimento.src =
        srcMovimento;

    iconeMovimento.alt =
        altMovimento;

    const posicao =
        document.createElement("span");

    posicao.className =
        "ranking-posicao";

    posicao.textContent =
        textoPosicaoRanking(
            item.posicao
        );

    posicaoWrap.appendChild(
        iconeMovimento
    );

    posicaoWrap.appendChild(
        posicao
    );

    const nome =
        document.createElement(
            "strong"
        );

    nome.className =
        "ranking-nome";

    nome.textContent =
        item.nome ||
        "Participante";

    if (
        item.usuarioId
    ) {
        nome.classList.add(
            "ranking-nome-clicavel"
        );

        nome.addEventListener(
            "click",
            () => {

                if (
                    typeof window
                        .abrirPerfilPublico ===
                    "function"
                ) {
                    window
                        .abrirPerfilPublico(
                            item.usuarioId
                        );
                }
            }
        );
    }

    const pontos =
        document.createElement(
            "strong"
        );
    pontos.className =
        "ranking-pontos";
    pontos.textContent =
        `${Number(
            item.pontos || 0
        ).toLocaleString(
            "pt-BR"
        )} pts`;

    linha.appendChild(
        posicaoWrap
    );

    linha.appendChild(
        nome
    );

    linha.appendChild(
        pontos
    );

    return linha;
}


async function carregarRanking() {
    rankingLista.replaceChildren();

    const carregando =
        document.createElement(
            "p"
        );

    carregando.className =
        "ranking-carregando";

    carregando.textContent =
        "Carregando ranking...";


    rankingLista.appendChild(
        carregando
    );


    minhaPosicaoRanking.hidden =
        true;

    minhaPosicaoRanking
        .replaceChildren();


    try {

        const resposta =
            await fetch(
                "/api/ranking",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            initData
                        })
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok
        ) {

            throw new Error(
                dados.erro ||
                "Ranking indisponível"
            );
        }


        rankingLista
            .replaceChildren();


        const ranking =
            Array.isArray(
                dados.ranking
            )
                ? dados.ranking
                : [];


        const minhaPosicao =
            dados.usuario ||
            null;


        if (
            ranking.length === 0
        ) {

            const vazio =
                document.createElement(
                    "p"
                );

            vazio.className =
                "ranking-vazio";

            vazio.textContent =
                "Ainda não há participantes no ranking.";


            rankingLista.appendChild(
                vazio
            );

        } else {

            for (
                const item
                of ranking
            ) {

                const souEu =
                    minhaPosicao &&
                    Number(
                        item.posicao
                    ) ===
                    Number(
                        minhaPosicao
                            .posicao
                    );


                rankingLista.appendChild(
                    criarLinhaRanking(
                        item,
                        souEu
                    )
                );
            }
        }


        // ========================================
        // POSIÇÃO DO PRÓPRIO USUÁRIO
        // ========================================

        if (minhaPosicao) {

            const posicao =
                document.createElement(
                    "span"
                );

            posicao.className =
                "ranking-posicao";

            posicao.textContent =
                textoPosicaoRanking(
                    minhaPosicao.posicao
                );


            const nome =
                document.createElement(
                    "strong"
                );

            nome.className =
                "ranking-nome";

            nome.textContent =
                minhaPosicao.nome ||
                "Você";

            if (
                minhaPosicao.usuarioId
            ) {
                nome.style.cursor =
                    "pointer";

                nome.addEventListener(
                    "click",
                    () => {

                        if (
                            typeof window
                                .abrirPerfilPublico ===
                            "function"
                        ) {
                            window
                                .abrirPerfilPublico(
                                    minhaPosicao
                                        .usuarioId
                                );
                        }
                    }
                );
            }

            const pontos =
                document.createElement(
                    "strong"
                );

            pontos.className =
                "ranking-pontos";

            pontos.textContent =
                `${Number(
                    minhaPosicao
                        .pontos || 0
                ).toLocaleString(
                    "pt-BR"
                )} pts`;


            minhaPosicaoRanking
                .appendChild(
                    posicao
                );

            minhaPosicaoRanking
                .appendChild(
                    nome
                );

            minhaPosicaoRanking
                .appendChild(
                    pontos
                );


            minhaPosicaoRanking.hidden =
                false;
        }


    } catch (erro) {

        console.error(
            "❌ Erro ao carregar ranking:",
            erro
        );


        rankingLista
            .replaceChildren();


        const erroElemento =
            document.createElement(
                "p"
            );

        erroElemento.className =
            "ranking-vazio";

        erroElemento.textContent =
            "❌ Não foi possível carregar o ranking.";


        rankingLista.appendChild(
            erroElemento
        );
    }
}

// ========================================
// BAÚ DA SEGUNDA CHANCE
// ========================================

function abrirTelaBau() {

    if (
        !usuarioAtual
            ?.bauSegundaChance
            ?.disponivel
    ) {
        return;
    }


    telaMenu.hidden = true;
    telaBau.hidden = false;

    resultadoBau.textContent =
        "Escolha um dos 3 baús.";


    for (
        let i = 0;
        i < botoesBau.length;
        i++
    ) {

        const botao =
            botoesBau[i];

        botao.disabled =
            false;

        botao.querySelector(
            ".card-jogo-icone"
        ).textContent =
            "🎁";

        botao.querySelector(
            "strong"
        ).textContent =
            `Baú ${i + 1}`;
    }
}


function voltarParaMenuBau() {

    telaBau.hidden =
        true;

    telaMenu.hidden =
        false;

    carregarUsuario();
}


async function escolherBau(
    indiceBau
) {

    if (abrindoBau) {
        return;
    }


    abrindoBau =
        true;


    for (
        const botao
        of botoesBau
    ) {

        botao.disabled =
            true;
    }


    resultadoBau.textContent =
        "🎁 Abrindo baú...";


    const resposta =
        await fetch(
            "/api/abrir-bau",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        initData,
                        indiceBau
                    })
            }
        );

    const dados =
        await resposta.json();

    if (!resposta.ok) {
        resultadoBau.textContent =
            dados.erro ||
            "❌ Não foi possível abrir o baú.";

        abrindoBau =
            false;

        await carregarUsuario();

        return;
    }

    const indiceBauPontos =
        Number(
            dados.indiceBauPontos
        );

    const pontosSorteados =
        Number(
            dados.pontosSorteados ||
            0
        );

    for (
        let i = 0;
        i < botoesBau.length;
        i++
    ) {
        const botao =
            botoesBau[i];

        if (
            i ===
            indiceBauPontos
        ) {

            botao.querySelector(
                ".card-jogo-icone"
            ).textContent =
                "✨";
            botao.querySelector(
                "strong"
            ).textContent =
                `+${pontosSorteados} pontos`;
        } else {
            botao.querySelector(
                ".card-jogo-icone"
            ).textContent =
                "🎡";

            botao.querySelector(
                "strong"
            ).textContent =
                "+1 giro extra";
        }
    }

    if (
        dados.tipoPremio ===
        "giro_extra"
    ) {
        resultadoBau.textContent =
            "🎡 Você ganhou +1 giro extra na Roleta de Pontos!";

    } else {
        resultadoBau.textContent =
            `✨ Você ganhou +${Number(
                dados.pontosGanhos
            ).toLocaleString(
                "pt-BR"
            )} pontos!`;
    }

    abrindoBau =
        false;

    await carregarUsuario();
}

// ========================================
// COMO GANHAR
// ========================================

function abrirTelaComoGanhar() {

    telaMenu.hidden =
        true;
    telaComoGanhar.hidden =
        false;
}

function voltarParaMenuComoGanhar() {

    telaComoGanhar.hidden =
        true;
    telaMenu.hidden =
        false;
}

function abrirTelaRanking() {

    telaMenu.hidden =
        true;
    telaRoleta.hidden =
        true;
    telaPontos.hidden =
        true;
    telaRanking.hidden =
        false;

    carregarRanking();
}

function voltarParaMenuRanking() {

    telaRanking.hidden =
        true;

    telaMenu.hidden =
        false;

    window.scrollTo({
        top: 0,
        behavior: "instant"
    });
}

// ========================================
// HISTÓRICO PÚBLICO DOS JOGOS
// ========================================

function criarLinhaHistorico(
    nome,
    textoResultado
) {

    const linha =
        document.createElement(
            "div"
        );


    linha.className =
        "historico-jogo-linha";


    const elementoNome =
        document.createElement(
            "span"
        );


    elementoNome.className =
        "historico-jogo-nome";


    elementoNome.textContent =
        nome ||
        "Participante";


    const elementoResultado =
        document.createElement(
            "strong"
        );


    elementoResultado.className =
        "historico-jogo-resultado";


    elementoResultado.textContent =
        textoResultado;


    linha.appendChild(
        elementoNome
    );


    linha.appendChild(
        elementoResultado
    );


    return linha;
}


// ========================================
// 7 ÚLTIMOS DA ROLETA DE PONTOS
// ========================================

async function carregarHistoricoPontos() {

    if (!historicoPontosLista) {
        return;
    }

    try {
        const resposta =
            await fetch(
                "/api/historico-pontos",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            initData
                        })
                }
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.erro ||
                "Histórico indisponível"
            );
        }

        historicoPontosLista
            .replaceChildren();

        const resultados =
            Array.isArray(
                dados.resultados
            )
                ? dados.resultados
                : [];

        if (
            resultados.length === 0
        ) {
            const vazio =
                document.createElement(
                    "span"
                );

            vazio.className =
                "historico-vazio";

            vazio.textContent =
                "Nenhum giro ainda.";

            historicoPontosLista
                .appendChild(
                    vazio
                );

            return;
        }

        for (
            const item
            of resultados
        ) {

            let textoResultado;

            const multiplicador =
                Number(
                    item.multiplicador ||
                    0
                );

            const prefixoMultiplicador =
                multiplicador > 0
                    ? `${multiplicador.toFixed(1)}x → `
                    : "";

            if (
                item.tipo ===
                "diamante"
            ) {

                textoResultado =
                    `${prefixoMultiplicador}💎 +${Number(
                        item.pontos || 1000
                    ).toLocaleString(
                        "pt-BR"
                    )} pts`;

            } else if (
                item.tipo ===
                "roleta_premiada"
            ) {

                textoResultado =
                    `${prefixoMultiplicador}🎡 Roleta Premiada`;

            } else {

                textoResultado =
                    `${prefixoMultiplicador}+${Number(
                        item.pontos || 0
                    ).toLocaleString(
                        "pt-BR"
                    )} pts`;
            }

            historicoPontosLista
                .appendChild(
                    criarLinhaHistorico(
                        item.nome,
                        textoResultado
                    )
                );
        }


    } catch (erro) {

        console.error(
            "❌ Erro no histórico de pontos:",
            erro
        );
    }
}


// ========================================
// GANHADORES DA ROLETA PREMIADA
// ========================================

async function carregarHistoricoPremiada() {

    if (!historicoPremiadaLista) {
        return;
    }


    try {

        const resposta =
            await fetch(
                "/api/historico-premiada",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            initData
                        })
                }
            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(
                dados.erro ||
                "Histórico indisponível"
            );
        }


        historicoPremiadaLista
            .replaceChildren();


        const ganhadores =
            Array.isArray(
                dados.ganhadores
            )
                ? dados.ganhadores
                : [];


        if (
            ganhadores.length === 0
        ) {

            const vazio =
                document.createElement(
                    "span"
                );


            vazio.className =
                "historico-vazio";


            vazio.textContent =
                "Nenhum ganhador ainda.";


            historicoPremiadaLista
                .appendChild(
                    vazio
                );


            return;
        }


        for (
            const item
            of ganhadores
        ) {

            historicoPremiadaLista
                .appendChild(
                    criarLinhaHistorico(
                        item.nome,
                        item.premio
                    )
                );
        }

    } catch (erro) {
        console.error(
            "❌ Erro no histórico da premiada:",
            erro
        );
    }
}

function abrirTelaPontos() {

    telaMenu.hidden = true;
    telaRoleta.hidden = true;
    telaPontos.hidden = false;
    resultadoPontos.textContent = "";
    itensPontosAtuais =
        itensPontosPrimeiroGiro;

    desenharRoletaPontos();
    carregarUsuario();
    carregarHistoricoPontos();
}

function voltarParaMenuPontos() {
    telaPontos.hidden = true;
    telaMenu.hidden = false;
}

function abrirTelaRoleta() {

    telaMenu.hidden = true;
    telaRoleta.hidden = false;
    desenharRoleta();
    verificarEstadoRoleta();
    carregarHistoricoPremiada();
}

function voltarParaMenu() {
    telaRoleta.hidden = true;
    telaMenu.hidden = false;
    verificarEstadoRoleta();
}

function desenharRoleta() {

    const centro =
        canvas.width / 2;

    const raio =
        centro - 10;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for (
        let i = 0;
        i < quantidade;
        i++
    ) {
        const itemAtual =
            itens[i];

        const inicio =
            -Math.PI / 2
            - anguloPorItem / 2
            + i * anguloPorItem;

        const fim =
            inicio +
            anguloPorItem;

        ctx.beginPath();

        ctx.moveTo(
            centro,
            centro
        );

        ctx.arc(
            centro,
            centro,
            raio,
            inicio,
            fim
        );
        ctx.closePath();

        // ========================================
        // DIAMANTE = FUNDO PRETO
        // ========================================

        if (
            itemAtual === "💎"
        ) {

            ctx.fillStyle =
                "#111111";

        } else {
            const parCores =
                coresBase[
                i % 2
                ];

            const gradiente =
                ctx.createLinearGradient(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

            gradiente.addColorStop(
                0,
                parCores[0]
            );

            gradiente.addColorStop(
                1,
                parCores[1]
            );

            ctx.fillStyle =
                gradiente;
        }

        ctx.fill();

        ctx.strokeStyle =
            "#d8c17c";

        ctx.lineWidth =
            3;

        ctx.stroke();

        const meio =
            inicio +
            anguloPorItem / 2;

        const distanciaTexto =
            raio * 0.70;

        const xTexto =
            centro +
            Math.cos(meio) *
            distanciaTexto;

        const yTexto =
            centro +
            Math.sin(meio) *
            distanciaTexto;

        ctx.save();

        ctx.translate(
            xTexto,
            yTexto
        );

        ctx.rotate(
            meio
        );

        ctx.textAlign =
            "center";
        ctx.textBaseline =
            "middle";
        ctx.fillStyle =
            "#ffffff";
        ctx.shadowColor =
            "rgba(0,0,0,0.7)";
        ctx.shadowBlur =
            4;

        // ========================================
        // DIAMANTE
        // ========================================
        if (
            itemAtual ===
            "💎"
        ) {

            ctx.save();

            ctx.rotate(
                Math.PI / 2
            );

            ctx.font =
                "52px Arial";

            ctx.fillText(
                "💎",
                0,
                0
            );
            ctx.restore();

        } else {
            const ehValor =
                itemAtual
                    .startsWith(
                        "R$"
                    );

            const tamanhoFonte =
                ehValor
                    ? 34
                    : 24;

            ctx.font =
                `bold ${tamanhoFonte}px Arial`;

            ctx.fillText(
                itemAtual,
                0,
                0
            );
        }
        ctx.restore();
    }

    const raioCentro =
        44;

    ctx.beginPath();

    ctx.arc(
        centro,
        centro,
        raioCentro,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#17151d";

    ctx.fill();

    ctx.strokeStyle =
        "#d8c17c";

    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(
        centro,
        centro,
        raioCentro - 5,
        0,
        Math.PI * 2
    );

    ctx.clip();

    if (
        logoCentro.complete &&
        logoCentro.naturalWidth > 0
    ) {
        const tamanhoLogo =
            90;

        ctx.drawImage(
            logoCentro,
            centro -
            tamanhoLogo / 2,
            centro -
            tamanhoLogo / 2,
            tamanhoLogo,
            tamanhoLogo
        );
    }

    ctx.restore();
}

function desenharRoletaPontos() {

    const centro =
        canvasPontos.width / 2;
    const raio =
        centro - 12;
    const quantidadePontos =
        itensPontosAtuais.length;
    const angulo =
        (Math.PI * 2) /
        quantidadePontos;
    ctxPontos.clearRect(
        0,
        0,
        canvasPontos.width,
        canvasPontos.height
    );

    for (
        let i = 0;
        i < quantidadePontos;
        i++
    ) {
        const inicio =
            -Math.PI / 2
            - angulo / 2
            + i * angulo;
        const fim =
            inicio + angulo;
        const item =
            itensPontosAtuais[i];
        ctxPontos.beginPath();
        ctxPontos.moveTo(
            centro,
            centro
        );

        ctxPontos.arc(
            centro,
            centro,
            raio,
            inicio,
            fim
        );

        ctxPontos.closePath();
        ctxPontos.fillStyle =
            item.tipo === "diamante" ||
                item.tipo === "roleta" ||
                item.tipo === "multiplicador"
                ? "#111111"
                : coresPontos[
                i %
                coresPontos.length
                ];;

        ctxPontos.fill();
        ctxPontos.strokeStyle =
            "#000000";
        ctxPontos.lineWidth = 3;
        ctxPontos.stroke();
        const meio =
            inicio +
            angulo / 2;
        const distancia =
            raio * 0.70;
        const x =
            centro +
            Math.cos(meio) *
            distancia;
        const y =
            centro +
            Math.sin(meio) *
            distancia;

        ctxPontos.save();

        ctxPontos.translate(
            x,
            y
        );

        ctxPontos.rotate(
            meio
        );

        ctxPontos.textAlign =
            "center";

        ctxPontos.textBaseline =
            "middle";

        ctxPontos.fillStyle =
            "#ffffff";

        if (
            item.tipo ===
            "pontos"
        ) {

            ctxPontos.font =
                "bold 55px Arial";

            ctxPontos.fillText(
                String(item.valor),
                0,
                0
            );
        }

        if (item.tipo === "diamante") {
            ctxPontos.save();

            ctxPontos.rotate(Math.PI / 2);

            ctxPontos.font = "70px Arial";
            ctxPontos.fillText("💎", 0, 0);

            ctxPontos.restore();
        }

        if (item.tipo === "roleta") {
            ctxPontos.save();

            ctxPontos.rotate(
                Math.PI / 2
            );

            ctxPontos.font =
                "70px Arial";

            ctxPontos.fillText(
                "🎡",
                0,
                0
            );

            ctxPontos.restore();
        }

        if (
            item.tipo ===
            "multiplicador"
        ) {

            ctxPontos.font =
                "bold 46px Arial";

            ctxPontos.fillText(
                item.texto,
                0,
                0
            );
        }

        ctxPontos.restore();
    }

    ctxPontos.beginPath();

    ctxPontos.arc(
        centro,
        centro,
        47,
        0,
        Math.PI * 2
    );

    ctxPontos.fillStyle =
        "#fff8e7";

    ctxPontos.fill();

    ctxPontos.strokeStyle =
        "#ffd166";

    ctxPontos.lineWidth = 6;

    ctxPontos.stroke();

    ctxPontos.font =
        "55px Arial";

    ctxPontos.textAlign =
        "center";

    ctxPontos.textBaseline =
        "middle";

    ctxPontos.fillText(
        "🏆",
        centro,
        centro
    );
}

// ========================================
// GIRAR ROLETA DE PONTOS
// ========================================

async function girarPontos() {

    if (girandoPontos) {
        return;
    }


    girandoPontos =
        true;


    botaoGirarPontos.disabled =
        true;


    botaoGirarPontos.textContent =
        "⏳ GIRANDO...";


    resultadoPontos.textContent =
        "";


    // ========================================
    // TODO NOVO GIRO COMEÇA COM
    // OS DOIS MULTIPLICADORES
    // ========================================

    itensPontosAtuais =
        itensPontosPrimeiroGiro;


    desenharRoletaPontos();


    let resposta;

    let dados;


    try {

        resposta =
            await fetch(
                "/api/girar-pontos",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            initData
                        })
                }
            );


        dados =
            await resposta.json();

    } catch (erro) {

        console.error(
            "❌ Erro no giro de pontos:",
            erro
        );


        resultadoPontos.textContent =
            "❌ Não foi possível realizar o giro.";


        girandoPontos =
            false;


        await carregarUsuario();

        return;
    }


    if (!resposta.ok) {

        if (
            resposta.status ===
            409 &&
            dados.semGirosPontos
        ) {

            resultadoPontos.textContent =
                "🔒 Você não possui giros disponíveis agora.";

        } else {

            resultadoPontos.textContent =
                dados.erro ||
                "❌ Não foi possível realizar o giro.";
        }


        girandoPontos =
            false;


        await carregarUsuario();

        return;
    }


    // ========================================
    // FUNÇÃO QUE MOVE A ROLETA
    // PARA UM ÍNDICE
    // ========================================

    function animarParaIndice(
        indice,
        quantidadeItens
    ) {

        const grausPorItem =
            360 /
            quantidadeItens;


        const destino =
            (
                360 -
                indice *
                grausPorItem
            ) % 360;


        const atualNormalizado =
            rotacaoPontosAtual %
            360;


        const ajuste =
            (
                destino -
                atualNormalizado +
                360
            ) % 360;


        const voltasExtras =
            6 * 360;


        rotacaoPontosAtual +=
            voltasExtras +
            ajuste;


        canvasPontos.style.transform =
            `rotate(${rotacaoPontosAtual}deg)`;
    }


    // ========================================
    // FINALIZA O RESULTADO REAL
    // ========================================

    function finalizarGiro() {

        const pontosAtualizados =
            Number(
                dados.usuario
                    ?.pontos ||
                0
            );


        const pontosGanhos =
            Number(
                dados.pontosGanhos ||
                0
            );


        const tipoFinal =
            dados.tipoFinal ||
            dados.tipo;


        const multiplicador =
            Number(
                dados.multiplicador ||
                0
            );


        const textoMultiplicador =
            multiplicador > 0
                ? `${multiplicador.toFixed(1)}x`
                : null;


        totalPontosElemento.textContent =
            `${pontosAtualizados.toLocaleString(
                "pt-BR"
            )} pts`;


        // ========================================
        // ROLETA PREMIADA
        //
        // O MULTIPLICADOR É PERDIDO.
        // CONTINUA SENDO SÓ 1 CHANCE.
        // ========================================

        if (
            tipoFinal ===
            "roleta_premiada"
        ) {

            if (
                dados.teveMultiplicador
            ) {

                resultadoPontos.textContent =
                    `🎡 Caiu na Roleta Premiada! ` +
                    `${textoMultiplicador} não se aplica. ` +
                    `Você ganhou 1 chance para usar em até 23h59.`;

            } else {

                resultadoPontos.textContent =
                    "🎡 1 chance na Roleta Premiada! Use em até 23h59. Essa chance não acumula.";
            }


        } else if (
            tipoFinal ===
            "diamante"
        ) {

            if (
                dados.teveMultiplicador
            ) {

                resultadoPontos.textContent =
                    `💎 ${textoMultiplicador} aplicado: ` +
                    `+${pontosGanhos.toLocaleString(
                        "pt-BR"
                    )} pontos!`;

            } else {

                resultadoPontos.textContent =
                    "💎 +1.000 pontos!";
            }


        } else {

            if (
                dados.teveMultiplicador
            ) {

                resultadoPontos.textContent =
                    `✨ ${textoMultiplicador} aplicado: ` +
                    `+${pontosGanhos.toLocaleString(
                        "pt-BR"
                    )} pontos!`;

            } else {

                resultadoPontos.textContent =
                    `🎉 +${pontosGanhos.toLocaleString(
                        "pt-BR"
                    )} pontos!`;
            }
        }

        if (
            dados.bauLiberado ===
            true
        ) {

            resultadoPontos.textContent +=
                " 🎁 O Baú da Segunda Chance foi liberado no menu!";
        }

        if (usuarioAtual) {
            usuarioAtual.girosPontosExtras =
                Number(
                    dados.usuario
                        ?.girosPontosExtras ||
                    0
                );

            usuarioAtual.pontos =
                pontosAtualizados;

            usuarioAtual.girosPremiada =
                Number(
                    dados.usuario
                        ?.girosPremiada ??
                    usuarioAtual
                        .girosPremiada ??
                    0
                );

            usuarioAtual
                .ultimoPeriodoDiario =
                dados.periodoDiario;

            usuarioAtual
                .giroDiarioDisponivel =
                false;
        }

        girandoPontos =
            false;

        botaoGirarPontos.disabled =
            true;

        botaoGirarPontos.textContent =
            "🔒 PRÓXIMO GIRO ÀS 08:30";

        carregarHistoricoPontos();

        carregarUsuario();
    }


    // ========================================
    // PRIMEIRO GIRO
    // 14 FATIAS
    // ========================================

    animarParaIndice(
        Number(
            dados.indice
        ),
        itensPontosPrimeiroGiro.length
    );


    setTimeout(
        () => {

            // ========================================
            // NÃO CAIU EM MULTIPLICADOR
            // TERMINA NORMALMENTE.
            // ========================================

            if (
                !dados.teveMultiplicador
            ) {

                finalizarGiro();

                return;
            }


            const multiplicador =
                Number(
                    dados.multiplicador
                );


            resultadoPontos.textContent =
                `✨ ${multiplicador.toFixed(1)}x! ` +
                `Você ganhou mais um giro!`;


            // ========================================
            // MULTIPLICADORES SOMEM
            // ANTES DO SEGUNDO GIRO
            // ========================================

            itensPontosAtuais =
                itensPontosSegundoGiro;


            desenharRoletaPontos();


            // Pequena pausa para a pessoa
            // perceber a mudança da roda.

            setTimeout(
                () => {

                    botaoGirarPontos.textContent =
                        "✨ GIRO MULTIPLICADO";


                    // ========================================
                    // SEGUNDO GIRO
                    // AGORA COM 12 FATIAS
                    // ========================================

                    animarParaIndice(
                        Number(
                            dados.indiceSegundoGiro
                        ),
                        itensPontosSegundoGiro.length
                    );


                    setTimeout(
                        finalizarGiro,
                        5100
                    );
                },
                900
            );
        },
        5100
    );
}

async function verificarEstadoRoleta() {

    if (verificandoEstado) {
        return;
    }


    verificandoEstado =
        true;


    try {

        const resposta =
            await fetch(
                `/api/estado-roleta?t=${Date.now()}`,
                {
                    cache:
                        "no-store"
                }
            );


        if (!resposta.ok) {
            return;
        }


        const dados =
            await resposta.json();


        const novaVersao =
            Number(
                dados.versao
            );


        // ========================================
        // ADMIN INICIOU OUTRA RODADA
        // ========================================

        if (
            versaoRodada !== null &&
            novaVersao !==
            versaoRodada
        ) {

            window.location.reload();

            return;
        }


        versaoRodada =
            novaVersao;


        rodadaAberta =
            dados.aberta ===
            true;


        if (
            statusRoletaMenu
        ) {

            statusRoletaMenu.hidden =
                true;
        }


        // A decisão de liberar o botão
        // agora depende de:
        //
        // normal + bônus pessoal.

        await carregarUsuario();


    } catch (erro) {

        if (
            versaoRodada ===
            null
        ) {

            resultado.textContent =
                "❌ Não foi possível verificar a rodada agora.";
        }

    } finally {

        verificandoEstado =
            false;
    }
}

function mostrarCanaisFaltando(canais) {

    canaisFaltandoElemento.innerHTML = "";

    for (const canal of canais) {

        const botao =
            document.createElement(
                "button"
            );

        botao.type = "button";

        botao.className =
            "botao-canal";

        botao.textContent =
            `📢 ENTRAR EM ${canal.nome}`;

        botao.addEventListener(
            "click",
            () => {

                if (
                    telegram &&
                    typeof telegram.openTelegramLink
                    === "function"
                ) {

                    telegram.openTelegramLink(
                        canal.url
                    );

                } else {

                    window.open(
                        canal.url,
                        "_blank"
                    );
                }
            }
        );

        canaisFaltandoElemento.appendChild(
            botao
        );
    }

    avisoComunidade.hidden = false;
}


async function verificarInscricao() {

    botaoVerificarInscricao.disabled =
        true;

    resultado.textContent =
        "🔎 Verificando sua inscrição...";

    try {

        const resposta =
            await fetch(
                "/api/verificar-comunidade",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        initData
                    })
                }
            );

        const dados =
            await resposta.json();

        if (!resposta.ok) {

            resultado.textContent =
                dados.erro ||
                "❌ Não foi possível verificar.";

            return;
        }

        if (!dados.inscrito) {

            mostrarCanaisFaltando(
                dados.canaisFaltando
            );

            resultado.textContent =
                "🔒 Sua inscrição ainda não foi identificada.";

            return;
        }

        avisoComunidade.hidden = true;

        resultado.textContent =
            "✅ Inscrição confirmada! Agora você pode girar.";

    } catch {

        resultado.textContent =
            "❌ Não foi possível verificar agora.";

    } finally {

        botaoVerificarInscricao.disabled =
            false;
    }
}

async function girar() {

    if (girandoPremiada) {
        return;
    }

    girandoPremiada =
        true;

    const liberarVisual =
        () => {
            girandoPremiada =
                false;

            if (
                itensPremiadaPendentes
            ) {
                const pendentes =
                    itensPremiadaPendentes;

                itensPremiadaPendentes =
                    null;

                aplicarItensPremiada(
                    pendentes,
                    true
                );
            }
        };

    botaoGirar.disabled =
        true;

    resultado.textContent =
        "Girando...";

    let resposta;
    let dados;


    try {

        resposta =
            await fetch(
                "/api/girar",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            initData,
                            versaoRodada
                        })
                }
            );

        dados =
            await resposta.json();

        if (!resposta.ok) {
            liberarVisual();

            if (
                resposta.status ===
                409 &&
                dados.rodadaAtualizada
            ) {

                window.location.reload();
                return;
            }

            if (
                resposta.status ===
                423 &&
                dados.rodadaFechada
            ) {
                rodadaAberta =
                    false;

                botaoGirar.disabled =
                    true;

                botaoGirar.textContent =
                    "🔒 GANHE GIROS NA ROLETA DE PONTOS";

                resultado.textContent =
                    "";

                return;
            }

            if (
                resposta.status ===
                410 &&
                dados.premiosEsgotados
            ) {
                rodadaUtilizada =
                    true;

                avisoComunidade.hidden =
                    true;

                resultado.textContent =
                    "🎁 Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀";

                botaoGirar.disabled =
                    true;

                return;
            }

            if (
                resposta.status ===
                409 &&
                dados.jaGirou
            ) {
                rodadaUtilizada =
                    true;

                avisoComunidade.hidden =
                    true;

                resultado.textContent =
                    "🔒 Você já utilizou sua rodada.";

                botaoGirar.disabled =
                    true;

                return;
            }

            if (
                resposta.status ===
                403 &&
                Array.isArray(
                    dados.canaisFaltando
                )
            ) {
                mostrarCanaisFaltando(
                    dados.canaisFaltando
                );

                resultado.textContent =
                    "🔒 Você precisa estar inscrito para participar.";

            } else {
                resultado.textContent =
                    dados.erro ||
                    "❌ Erro ao realizar o giro.";
            }

            botaoGirar.disabled =
                false;

            return;
        }

    } catch (erro) {

        liberarVisual();

        resultado.textContent =
            "❌ Erro ao realizar o giro.";

        botaoGirar.disabled =
            false;

        return;
    }

    // ========================================
    // O SERVIDOR ENVIA A CONFIGURAÇÃO
    // EXATA USADA NESTE GIRO.
    // ========================================
    aplicarItensPremiada(
        dados.itensGiro,
        true
    );

    if (
        dados.origem ===
        "normal"
    ) {
        rodadaUtilizada =
            true;
    }

    const indice =
        Number(
            dados.indice
        );

    const grausPorItem =
        360 /
        quantidade;

    const destino =
        (
            360 -
            indice *
            grausPorItem
        ) % 360;

    const atualNormalizado =
        rotacaoAtual %
        360;

    const ajuste =
        (
            destino -
            atualNormalizado +
            360
        ) % 360;

    const voltasExtras =
        6 * 360;

    rotacaoAtual +=
        voltasExtras +
        ajuste;

    canvas.style.transform =
        `rotate(${rotacaoAtual}deg)`;

    setTimeout(
        () => {
            const premio =
                dados.premio;

            // ========================================
            // DIAMANTE
            // ========================================
            if (
                dados.tipoResultado ===
                "diamante"
            ) {
                resultado.textContent =
                    "💎 Você ganhou +1.000 pontos!";

            } else if (
                dados.tipoResultado ===
                "dinheiro"
            ) {
                resultado.textContent =
                    `🎉 Você ganhou ${premio}!`;
            } else {
                resultado.textContent =
                    "😕 Não foi dessa vez!";
            }

            girandoPremiada =
                false;

            itensPremiadaPendentes =
                null;

            // ========================================
            // AGORA SIM PODE MOSTRAR
            // A CONFIGURAÇÃO DO PRÓXIMO GIRO.
            // ========================================

            if (
                Array.isArray(
                    dados.itensDepois
                )
            ) {
                aplicarItensPremiada(
                    dados.itensDepois,
                    true
                );
            }

            carregarUsuario();
            carregarHistoricoPremiada();

        },
        5100
    );
}

botaoGirarPontos.addEventListener(
    "click",
    girarPontos
);

botaoAbrirBau.addEventListener(
    "click",
    abrirTelaBau
);


botaoVoltarMenuBau.addEventListener(
    "click",
    voltarParaMenuBau
);


for (
    let i = 0;
    i < botoesBau.length;
    i++
) {

    botoesBau[i]
        .addEventListener(
            "click",
            () => escolherBau(
                i
            )
        );
}

botaoAbrirComoGanhar.addEventListener(
    "click",
    abrirTelaComoGanhar
);

botaoVoltarMenuComoGanhar.addEventListener(
    "click",
    voltarParaMenuComoGanhar
);

botaoAbrirRanking.addEventListener(
    "click",
    abrirTelaRanking
);

botaoVoltarMenuRanking.addEventListener(
    "click",
    voltarParaMenuRanking
);

botaoVoltarMenuRankingFlutuante.addEventListener(
    "click",
    voltarParaMenuRanking
);

botaoAbrirPontos.addEventListener(
    "click",
    abrirTelaPontos
);

botaoVoltarMenuPontos.addEventListener(
    "click",
    voltarParaMenuPontos
);

botaoModoSorte.addEventListener(
    "click",
    () => {
        telaModos.hidden = true;
        telaMenu.hidden = false;
    }
);


botaoAbrirRoleta.addEventListener(
    "click",
    abrirTelaRoleta
);

botaoVoltarMenu.addEventListener(
    "click",
    voltarParaMenu
);

botaoGirar.addEventListener(
    "click",
    girar
);

botaoVerificarInscricao.addEventListener(
    "click",
    verificarInscricao
);

desenharRoleta();

desenharRoletaPontos();

verificarAcesso()
    .then((permitido) => {

        if (permitido) {

            verificarEstadoRoleta();

            carregarUsuario();
        }
    });

setInterval(
    verificarEstadoRoleta,
    10000
);

document.addEventListener(
    "visibilitychange",
    () => {

        if (!document.hidden) {

            verificarEstadoRoleta();
        }
    }
);

window.addEventListener(
    "focus",
    verificarEstadoRoleta
);