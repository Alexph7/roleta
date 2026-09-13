
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

const telaRoleta =
    document.getElementById(
        "tela-roleta"
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

const itens = [
    "QUASE",
    "R$ 5",
    "NÃO",
    "R$ 10",
    "QUASE",
    "R$ 6",
    "R$ 9",
    "TRAVEE",
    "PRA FORA",
    "R$ 7"
];

const coresBase = [
    ["#245a94", "#133658"],
    ["#d94a57", "#8c2430"]
];

const quantidade = itens.length;

const anguloPorItem =
    (Math.PI * 2) / quantidade;

let rotacaoAtual = 0;
let versaoRodada = null;
let rodadaAberta = false;
let rodadaUtilizada = false;
let verificandoEstado = false;

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
                "⛔ Esta conta não está habilitada para acessar esta área.";

            return false;
        }

        telaAcesso.hidden = true;
        telaMenu.hidden = false;

        return true;

    } catch (erro) {

        telaMenu.hidden = true;

        statusAcesso.textContent =
            "❌ Não foi possível verificar o acesso agora.";

        return false;
    }
}

function abrirTelaRoleta() {

    telaMenu.hidden = true;

    telaRoleta.hidden = false;

    desenharRoleta();

    verificarAcesso()
        .then((permitido) => {

            if (permitido) {
                verificarEstadoRoleta();
            }
        });
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
        const inicio =
            -Math.PI / 2
            - anguloPorItem / 2
            + i * anguloPorItem;

        const fim =
            inicio + anguloPorItem;

        const parCores =
            coresBase[i % 2];

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

        ctx.fillStyle =
            gradiente;

        ctx.fill();

        ctx.strokeStyle =
            "#d8c17c";

        ctx.lineWidth = 3;

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

        ctx.rotate(meio);

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.fillStyle =
            "#ffffff";

        const ehValor =
            itens[i].startsWith("R$");

        const tamanhoFonte =
            ehValor
                ? 40
                : 30;

        ctx.font =
            `bold ${tamanhoFonte}px Arial`;

        ctx.shadowColor =
            "rgba(0,0,0,0.7)";

        ctx.shadowBlur = 4;

        ctx.fillText(
            itens[i],
            0,
            0
        );

        ctx.restore();
    }

    const raioCentro = 44;

    ctx.beginPath();
    ctx.arc(
        centro,
        centro,
        raioCentro,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = "#17151d";
    ctx.fill();
    ctx.strokeStyle = "#d8c17c";
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

    if (logoCentro.complete && logoCentro.naturalWidth > 0) {
        const tamanhoLogo = 90;

        ctx.drawImage(
            logoCentro,
            centro - tamanhoLogo / 2,
            centro - tamanhoLogo / 2,
            tamanhoLogo,
            tamanhoLogo
        );
    }

    ctx.restore();
}

async function verificarEstadoRoleta() {

    if (verificandoEstado) {
        return;
    }

    verificandoEstado = true;

    try {

        const resposta =
            await fetch(
                `/api/estado-roleta?t=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );

        if (!resposta.ok) {
            return;
        }

        const dados =
            await resposta.json();

        const novaVersao =
            Number(dados.versao);

        // ADMIN DEU /roleta
        if (
            versaoRodada !== null &&
            novaVersao !== versaoRodada
        ) {

            window.location.reload();

            return;
        }

        versaoRodada =
            novaVersao;

        rodadaAberta =
            dados.aberta === true;

        if (statusRoletaMenu) {

            if (rodadaAberta) {

                statusRoletaMenu.textContent =
                    "🟢 RODADA DISPONÍVEL";

            } else {

                statusRoletaMenu.textContent =
                    "🔒 AGUARDANDO NOVA RODADA";
            }
        }

        // RODADA FECHADA
        if (!rodadaAberta) {

            botaoGirar.disabled = true;

            botaoGirar.textContent =
                "🔒 AGUARDANDO LIBERAÇÃO";

            if (!rodadaUtilizada) {

                resultado.textContent =
                    "🔒 A próxima rodada ainda não foi liberada.";
            }

            return;
        }


        // RODADA ABERTA
        if (!rodadaUtilizada) {

            botaoGirar.disabled =
                false;

            botaoGirar.textContent =
                "🎡 GIRAR";

            if (
                resultado.textContent ===
                "🔒 A próxima rodada ainda não foi liberada."
            ) {

                resultado.textContent =
                    "";
            }
        }

    } catch (erro) {

        if (versaoRodada === null) {

            resultado.textContent =
                "❌ Não foi possível verificar a rodada agora.";
        }

    } finally {

        verificandoEstado = false;
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

    botaoGirar.disabled = true;

    resultado.textContent =
        "Girando...";

    let resposta;
    let dados;

    try {

        resposta = await fetch(
            "/api/girar",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    initData,
                    versaoRodada
                })
            }
        );

        dados =
            await resposta.json();

        if (!resposta.ok) {

            if (
                resposta.status === 409 &&
                dados.rodadaAtualizada
            ) {

                window.location.reload();

                return;
            }


            if (
                resposta.status === 423 &&
                dados.rodadaFechada
            ) {

                rodadaAberta = false;

                botaoGirar.disabled =
                    true;

                botaoGirar.textContent =
                    "🔒 AGUARDANDO LIBERAÇÃO";

                resultado.textContent =
                    "🔒 A próxima rodada ainda não foi liberada.";

                return;
            }

            if (
                resposta.status === 410 &&
                dados.premiosEsgotados
            ) {

                rodadaUtilizada = true;

                avisoComunidade.hidden =
                    true;

                resultado.textContent =
                    "🎁 Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀";

                botaoGirar.disabled =
                    true;

                return;
            }


            if (
                resposta.status === 409 &&
                dados.jaGirou
            ) {
                rodadaUtilizada = true;

                avisoComunidade.hidden =
                    true;

                resultado.textContent =
                    "🔒 Você já utilizou sua rodada.";

                botaoGirar.disabled =
                    true;

                return;
            }

            if (
                resposta.status === 403 &&
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

            botaoGirar.disabled = false;

            return;
        }

    } catch {

        resultado.textContent =
            "❌ Erro ao realizar o giro.";

        botaoGirar.disabled = false;

        return;
    }

    rodadaUtilizada = true;

    const indice = dados.indice;

    const grausPorItem =
        360 / quantidade;

    const destino =
        (
            360 -
            indice * grausPorItem
        ) % 360;

    const atualNormalizado =
        rotacaoAtual % 360;

    const ajuste =
        (
            destino -
            atualNormalizado +
            360
        ) % 360;

    const voltasExtras = 6 * 360;

    rotacaoAtual +=
        voltasExtras +
        ajuste;

    canvas.style.transform =
        `rotate(${rotacaoAtual}deg)`;

    setTimeout(() => {

        const premio =
            dados.premio;

        const semPremio = [
            "QUASE",
            "NÃO",
            "QUASE",
            "TRAVEE",
            "PRA FORA"
        ];

        if (semPremio.includes(premio)) {

            resultado.textContent =
                "😕 Não foi dessa vez!";

        } else {

            resultado.textContent =
                `🎉 Você ganhou ${premio}!`;
        }

        botaoGirar.disabled = true;

        botaoGirar.textContent =
            "🔒 RODADA UTILIZADA";

    }, 5100);
}

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

verificarEstadoRoleta();

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