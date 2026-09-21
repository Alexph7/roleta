(() => {

    const telaMenu =
        document.getElementById(
            "tela-menu"
        );


    const tela =
        document.getElementById(
            "tela-100x100"
        );


    const botaoAbrir =
        document.getElementById(
            "abrir-100x100"
        );


    const botaoVoltar =
        document.getElementById(
            "voltar-menu-100x100"
        );


    const botaoAcao =
        document.getElementById(
            "acao-100x100"
        );


    const resultado =
        document.getElementById(
            "resultado-100x100"
        );


    const saldo =
        document.getElementById(
            "saldo-100x100"
        );


    const statusMenu =
        document.getElementById(
            "status-100x100-menu"
        );


    const etapas =
        Array.from(
            document.querySelectorAll(
                ".cemx100-etapa"
            )
        );


    const quadrados =
        Array.from(
            document.querySelectorAll(
                ".cemx100-quadrado"
            )
        );


    const telegram =
        window.Telegram?.WebApp;


    const initData =
        telegram?.initData ||
        "";


    let estadoAtual =
        null;


    let processando =
        false;


    // ========================================
    // API
    // ========================================

    async function chamarApi(
        rota,
        dados = {}
    ) {

        const resposta =
            await fetch(
                rota,
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
                            ...dados
                        })
                }
            );


        let retorno = {};


        try {

            retorno =
                await resposta.json();

        } catch {

            retorno = {};
        }


        if (
            !resposta.ok
        ) {

            const erro =
                new Error(
                    retorno.erro ||
                    "Não foi possível continuar."
                );


            erro.dados =
                retorno;


            throw erro;
        }


        return retorno;
    }


    // ========================================
    // VISUAL DOS QUADRADOS
    // ========================================

    function limparQuadrado(
        quadrado
    ) {

        quadrado.classList.remove(
            "revelado",
            "resultado-pontos",
            "resultado-x",
            "resultado-diamante"
        );


        const span =
            quadrado.querySelector(
                "span"
            );


        if (span) {

            span.textContent =
                "?";
        }


        quadrado.disabled =
            true;
    }


    function revelarQuadrado(
        quadrado,
        jogada
    ) {

        quadrado.classList.add(
            "revelado"
        );


        const span =
            quadrado.querySelector(
                "span"
            );


        if (
            !span
        ) {

            return;
        }


        if (
            jogada.tipo ===
            "x"
        ) {

            quadrado.classList.add(
                "resultado-x"
            );

            span.textContent =
                "✕";

            return;
        }


        if (
            jogada.tipo ===
            "diamante"
        ) {

            quadrado.classList.add(
                "resultado-diamante"
            );

            span.textContent =
                "💎";

            return;
        }


        quadrado.classList.add(
            "resultado-pontos"
        );


        span.textContent =
            `${Number(
                jogada.premio ||
                0
            ).toLocaleString(
                "pt-BR"
            )} PTS`;
    }


    // ========================================
    // TEXTO DO MENU
    // ========================================

    function atualizarStatusMenu(
        estado
    ) {

        if (
            !statusMenu ||
            !estado
        ) {

            return;
        }


        if (
            estado.partidaAtiva
        ) {

            statusMenu.textContent =
                "🎯 Partida em andamento";

            return;
        }


        if (
            Number(
                estado.partidasUsadas ||
                0
            ) >=
            Number(
                estado.maxPartidas ||
                3
            )
        ) {

            statusMenu.textContent =
                "🕣 Volte às 08:30";

            return;
        }


        const custo =
            Number(
                estado.proximoCusto ||
                0
            );


        if (
            custo === 0
        ) {

            statusMenu.textContent =
                "🎟 1 chance grátis";

            return;
        }


        statusMenu.textContent =
            `Próxima: ${custo.toLocaleString(
                "pt-BR"
            )} pts`;
    }


    // ========================================
    // RENDERIZAR
    // ========================================

    function renderizar(
        estado
    ) {

        if (
            !estado
        ) {

            return;
        }


        estadoAtual =
            estado;


        const pontos =
            Number(
                estado.pontos ||
                0
            );


        saldo.textContent =
            `${pontos.toLocaleString(
                "pt-BR"
            )} pts`;


        const saldoGlobal =
            document.getElementById(
                "total-pontos"
            );


        if (
            saldoGlobal
        ) {

            saldoGlobal.textContent =
                `${pontos.toLocaleString(
                    "pt-BR"
                )} pts`;
        }


        atualizarStatusMenu(
            estado
        );


        const ativa =
            estado.partidaAtiva ||
            null;


        const exibida =
            ativa ||
            estado.ultimaPartida ||
            null;


        const historico =
            Array.isArray(
                exibida?.historico
            )

                ? exibida.historico

                : [];


        // ========================================
        // RESETA TODA CARTELA
        // ========================================

        for (
            const etapa
            of etapas
        ) {

            etapa.classList.remove(
                "ativa",
                "concluida"
            );
        }


        for (
            const quadrado
            of quadrados
        ) {

            limparQuadrado(
                quadrado
            );
        }


        // ========================================
        // RECONSTRÓI O QUE JÁ FOI ABERTO
        // ========================================

        for (
            const jogada
            of historico
        ) {

            const linha =
                Number(
                    jogada.linha
                );


            const lado =
                Number(
                    jogada.lado
                );


            const etapa =
                etapas[
                linha
                ];


            if (
                etapa
            ) {

                etapa.classList.add(
                    "concluida"
                );
            }


            const quadrado =
                document.querySelector(
                    `.cemx100-quadrado[data-linha="${linha}"][data-lado="${lado}"]`
                );


            if (
                quadrado
            ) {

                revelarQuadrado(
                    quadrado,
                    jogada
                );
            }
        }


        // ========================================
        // LIBERA SOMENTE A LINHA ATUAL
        // ========================================

        if (
            ativa
        ) {

            const linhaAtual =
                Number(
                    ativa.linhaAtual ||
                    0
                );


            const etapa =
                etapas[
                linhaAtual
                ];


            if (
                etapa
            ) {

                etapa.classList.add(
                    "ativa"
                );
            }


            for (
                const quadrado
                of quadrados
            ) {

                const linha =
                    Number(
                        quadrado.dataset
                            .linha
                    );


                if (
                    linha ===
                    linhaAtual &&
                    !quadrado.classList
                        .contains(
                            "revelado"
                        )
                ) {

                    quadrado.disabled =
                        processando;
                }
            }
        }


        // ========================================
        // MENSAGEM
        // ========================================

        if (
            ativa
        ) {

            const premio =
                Number(
                    ativa
                        .premioProvisorio ||
                    0
                );


            if (
                premio > 0
            ) {

                resultado.textContent =
                    `✅ Você tem ${premio.toLocaleString(
                        "pt-BR"
                    )} pontos garantidos se parar agora. Arrisque a próxima linha ou resgate.`;

            } else {

                resultado.textContent =
                    "Escolha um dos dois quadrados destacados.";
            }

        } else if (
            exibida?.status ===
            "perdeu"
        ) {

            resultado.textContent =
                "❌ Você encontrou o X. O prêmio desta partida foi perdido.";

        } else if (
            exibida?.status ===
            "resgatou"
        ) {

            resultado.textContent =
                `✅ Você parou e resgatou ${Number(
                    exibida
                        .premioProvisorio ||
                    0
                ).toLocaleString(
                    "pt-BR"
                )} pontos.`;

        } else if (
            exibida?.status ===
            "diamante"
        ) {

            resultado.textContent =
                "💎 Você chegou ao fim do 100x100 e conquistou um diamante!";

        } else {

            resultado.textContent =
                "Comece quando quiser.";
        }


        // ========================================
        // BOTÃO ÚNICO
        // ========================================

        if (
            processando
        ) {

            botaoAcao.disabled =
                true;

            botaoAcao.textContent =
                "AGUARDE...";

            return;
        }


        if (
            ativa
        ) {

            const premio =
                Number(
                    ativa
                        .premioProvisorio ||
                    0
                );


            if (
                premio > 0
            ) {

                botaoAcao.disabled =
                    false;

                botaoAcao.textContent =
                    `RESGATAR ${premio.toLocaleString(
                        "pt-BR"
                    )} E PARAR`;

            } else {

                botaoAcao.disabled =
                    true;

                botaoAcao.textContent =
                    "ESCOLHA UM QUADRADO";
            }


            return;
        }


        const usadas =
            Number(
                estado.partidasUsadas ||
                0
            );


        const maximo =
            Number(
                estado.maxPartidas ||
                3
            );


        if (
            usadas >=
            maximo
        ) {

            botaoAcao.disabled =
                true;

            botaoAcao.textContent =
                "VOLTE AMANHÃ ÀS 08:30";

            return;
        }


        const custo =
            Number(
                estado.proximoCusto ||
                0
            );


        if (
            custo === 0
        ) {

            botaoAcao.disabled =
                false;

            botaoAcao.textContent =
                "JOGAR 1 CHANCE";

            return;
        }


        if (
            pontos <
            custo
        ) {

            botaoAcao.disabled =
                true;

            botaoAcao.textContent =
                `PRECISA DE ${custo.toLocaleString(
                    "pt-BR"
                )} PONTOS`;

            return;
        }


        botaoAcao.disabled =
            false;

        botaoAcao.textContent =
            `JOGAR POR ${custo.toLocaleString(
                "pt-BR"
            )} PONTOS`;
    }


    // ========================================
    // CARREGAR
    // ========================================

    async function carregarEstado() {

        try {

            processando =
                true;


            resultado.textContent =
                "Carregando 100x100...";


            const dados =
                await chamarApi(
                    "/api/100x100/estado"
                );


            processando =
                false;


            renderizar(
                dados
            );


        } catch (
        erro
        ) {

            processando =
                false;


            resultado.textContent =
                `❌ ${erro.message}`;


            if (
                estadoAtual
            ) {

                renderizar(
                    estadoAtual
                );
            }
        }
    }


    // ========================================
    // INICIAR / RESGATAR
    // ========================================

    async function acaoPrincipal() {

        if (
            processando
        ) {

            return;
        }


        try {

            processando =
                true;


            renderizar(
                estadoAtual
            );


            let dados;


            if (
                estadoAtual
                    ?.partidaAtiva &&
                Number(
                    estadoAtual
                        .partidaAtiva
                        .premioProvisorio ||
                    0
                ) > 0
            ) {

                dados =
                    await chamarApi(
                        "/api/100x100/resgatar"
                    );

            } else {

                dados =
                    await chamarApi(
                        "/api/100x100/iniciar"
                    );
            }


            processando =
                false;


            renderizar(
                dados.estado
            );


        } catch (
        erro
        ) {

            processando =
                false;


            const estadoErro =
                erro.dados
                    ?.estado;


            if (
                estadoErro
            ) {

                renderizar(
                    estadoErro
                );

            } else if (
                estadoAtual
            ) {

                renderizar(
                    estadoAtual
                );
            }


            resultado.textContent =
                `❌ ${erro.message}`;
        }
    }


    // ========================================
    // ESCOLHER QUADRADO
    // ========================================

    async function escolher(
        quadrado
    ) {

        if (
            processando ||
            quadrado.disabled
        ) {

            return;
        }


        const lado =
            Number(
                quadrado.dataset
                    .lado
            );


        try {

            processando =
                true;


            renderizar(
                estadoAtual
            );


            const dados =
                await chamarApi(
                    "/api/100x100/escolher",
                    {
                        lado
                    }
                );


            processando =
                false;


            renderizar(
                dados.estado
            );


        } catch (
        erro
        ) {

            processando =
                false;


            const estadoErro =
                erro.dados
                    ?.estado;


            if (
                estadoErro
            ) {

                renderizar(
                    estadoErro
                );

            } else if (
                estadoAtual
            ) {

                renderizar(
                    estadoAtual
                );
            }


            resultado.textContent =
                `❌ ${erro.message}`;
        }
    }


    // ========================================
    // NAVEGAÇÃO
    // ========================================

    function abrir() {

        telaMenu.hidden =
            true;


        tela.hidden =
            false;


        carregarEstado();
    }


    function voltar() {

        tela.hidden =
            true;


        telaMenu.hidden =
            false;


        if (
            estadoAtual
        ) {

            atualizarStatusMenu(
                estadoAtual
            );
        }
    }


    // ========================================
    // EVENTOS
    // ========================================

    botaoAbrir.addEventListener(
        "click",
        abrir
    );


    botaoVoltar.addEventListener(
        "click",
        voltar
    );


    botaoAcao.addEventListener(
        "click",
        acaoPrincipal
    );


    for (
        const quadrado
        of quadrados
    ) {

        quadrado.addEventListener(
            "click",
            () =>
                escolher(
                    quadrado
                )
        );
    }


    // Já consulta silenciosamente
    // para o card do menu mostrar
    // grátis / 100 / 200 / 08:30.
    chamarApi(
        "/api/100x100/estado"
    )
        .then(
            dados => {

                estadoAtual =
                    dados;

                atualizarStatusMenu(
                    dados
                );
            }
        )
        .catch(
            () => {

                statusMenu.textContent =
                    "100x100";
            }
        );

})();