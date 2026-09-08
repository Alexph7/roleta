const roleta = document.getElementById("roleta");

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
    "TENTE",
    "R$ 11",
    "EITA",
    "R$ 7"
];

const quantidade = itens.length;

let rotacaoAtual = 0;

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
                    initData
                })
            }
        );

        dados =
            await resposta.json();

        if (!resposta.ok) {

            if (
                resposta.status === 410 &&
                dados.premiosEsgotados
            ) {

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

    roleta.style.transform = `rotate(${rotacaoAtual}deg)`;

    setTimeout(() => {

        const premio =
            dados.premio;

        const semPremio = [
            "QUASE",
            "NÃO",
            "TENTE",
            "EITA"
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

botaoGirar.addEventListener(
    "click",
    girar
);

botaoVerificarInscricao.addEventListener(
    "click",
    verificarInscricao
);
