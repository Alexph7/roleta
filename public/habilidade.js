(function () {
    const botaoAbrir = document.getElementById("abrir-habilidade");
    const botaoVoltar = document.getElementById("voltar-menu-habilidade");
    const telaHabilidade = document.getElementById("tela-habilidade");
    const telaModos = document.getElementById("tela-modos");

    if (!botaoAbrir || !botaoVoltar || !telaHabilidade || !telaModos) {
        console.error("Elementos do Modo Habilidade nao encontrados.");
        return;
    }

    botaoAbrir.addEventListener("click", () => {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });

        telaHabilidade.hidden = false;
    });

    botaoVoltar.addEventListener("click", () => {
        telaHabilidade.hidden = true;
        telaModos.hidden = false;
    });

    // Botao VOLTAR do Modo Sorte (tela-menu) para a escolha de modos
    const botaoVoltarSorte = document.getElementById("voltar-modos-sorte");

    if (botaoVoltarSorte) {
        botaoVoltarSorte.addEventListener("click", () => {
            document.querySelectorAll("main > .tela").forEach(tela => {
                tela.hidden = true;
            });

            telaModos.hidden = false;
        });
    }
})();