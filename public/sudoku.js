(function () {
    // ========================================
    // ELEMENTOS
    // ========================================

    const telaHabilidade = document.getElementById("tela-habilidade");
    const telaSudoku = document.getElementById("tela-sudoku");
    const botaoAbrir = document.getElementById("abrir-sudoku");
    const botaoVoltar = document.getElementById("voltar-menu-sudoku");

    const areaRegras = document.getElementById("sudoku-regras");
    const areaJogo = document.getElementById("sudoku-jogo");
    const grade = document.getElementById("sudoku-grade");
    const teclado = document.getElementById("sudoku-teclado");

    const placar = document.getElementById("sudoku-placar");
    const placarNivel = document.getElementById("sudoku-placar-nivel");
    const placarTempo = document.getElementById("sudoku-placar-tempo");
    const placarErros = document.getElementById("sudoku-placar-erros");

    const botaoNotas = document.getElementById("sudoku-notas");
    const botaoApagar = document.getElementById("sudoku-apagar");
    const resultado = document.getElementById("resultado-sudoku");
    const botaoDeNovo = document.getElementById("sudoku-de-novo");
    const botoesNivel = Array.from(document.querySelectorAll(".sudoku-nivel"));

    if (
        !telaHabilidade || !telaSudoku || !botaoAbrir || !botaoVoltar ||
        !areaRegras || !areaJogo || !grade || !teclado ||
        !placar || !placarNivel || !placarTempo || !placarErros ||
        !botaoNotas || !botaoApagar || !resultado || !botaoDeNovo
    ) {
        console.error("Elementos do Sudoku nao encontrados.");
        return;
    }

    // Quantas casas ficam vazias em cada nivel
    const NIVEIS = {
        facil: { nome: "FÁCIL", vazias: 38 },
        medio: { nome: "MÉDIO", vazias: 47 },
        dificil: { nome: "DIFÍCIL", vazias: 54 }
    };

    // ========================================
    // ESTADO DA PARTIDA
    // ========================================

    let solucao = [];
    let inicial = [];
    let atual = [];
    let notas = [];
    let celulas = [];
    let botoesNumero = [];

    let selecionada = -1;
    let modoNotas = false;
    let erros = 0;
    let inicio = 0;
    let relogio = null;
    let terminado = true;

    // ========================================
    // GERADOR DE SUDOKU
    // ========================================

    function embaralhar(lista) {
        for (let i = lista.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lista[i], lista[j]] = [lista[j], lista[i]];
        }
        return lista;
    }

    function podeColocar(g, pos, n) {
        const lin = Math.floor(pos / 9);
        const col = pos % 9;

        for (let i = 0; i < 9; i++) {
            if (g[lin * 9 + i] === n) return false;
            if (g[i * 9 + col] === n) return false;
        }

        const bl = lin - (lin % 3);
        const bc = col - (col % 3);

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (g[(bl + r) * 9 + bc + c] === n) return false;
            }
        }

        return true;
    }

    function preencher(g) {
        const pos = g.indexOf(0);
        if (pos === -1) return true;

        for (const n of embaralhar([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (podeColocar(g, pos, n)) {
                g[pos] = n;
                if (preencher(g)) return true;
                g[pos] = 0;
            }
        }

        return false;
    }

    // Conta solucoes (para no limite). Usado para garantir resposta unica.
    function contarSolucoes(g, limite) {
        let melhor = -1;
        let melhorOpcoes = null;

        for (let pos = 0; pos < 81; pos++) {
            if (g[pos] !== 0) continue;

            const opcoes = [];
            for (let n = 1; n <= 9; n++) {
                if (podeColocar(g, pos, n)) opcoes.push(n);
            }

            if (opcoes.length === 0) return 0;

            if (!melhorOpcoes || opcoes.length < melhorOpcoes.length) {
                melhor = pos;
                melhorOpcoes = opcoes;
                if (opcoes.length === 1) break;
            }
        }

        if (melhor === -1) return 1;

        let total = 0;
        for (const n of melhorOpcoes) {
            g[melhor] = n;
            total += contarSolucoes(g, limite);
            g[melhor] = 0;
            if (total >= limite) break;
        }

        return total;
    }

    function gerar(nivel) {
        const completo = new Array(81).fill(0);
        preencher(completo);

        const puzzle = completo.slice();
        const posicoes = embaralhar([...Array(81).keys()]);
        let removidas = 0;

        for (const pos of posicoes) {
            if (removidas >= NIVEIS[nivel].vazias) break;

            const guardado = puzzle[pos];
            puzzle[pos] = 0;

            if (contarSolucoes(puzzle.slice(), 2) !== 1) {
                puzzle[pos] = guardado;
            } else {
                removidas++;
            }
        }

        return { completo, puzzle };
    }

    // ========================================
    // TEMPO
    // ========================================

    function formatarTempo(ms) {
        const total = Math.floor(ms / 1000);
        const min = String(Math.floor(total / 60)).padStart(2, "0");
        const seg = String(total % 60).padStart(2, "0");
        return `${min}:${seg}`;
    }

    function pararRelogio() {
        if (relogio) {
            clearInterval(relogio);
            relogio = null;
        }
    }

    function iniciarRelogio() {
        pararRelogio();
        inicio = Date.now();
        placarTempo.textContent = "00:00";
        relogio = setInterval(() => {
            placarTempo.textContent = formatarTempo(Date.now() - inicio);
        }, 1000);
    }

    // ========================================
    // DESENHO
    // ========================================

    function mesmaArea(a, b) {
        const la = Math.floor(a / 9), ca = a % 9;
        const lb = Math.floor(b / 9), cb = b % 9;

        if (la === lb || ca === cb) return true;

        return (
            Math.floor(la / 3) === Math.floor(lb / 3) &&
            Math.floor(ca / 3) === Math.floor(cb / 3)
        );
    }

    function montarGrade() {
        grade.replaceChildren();
        celulas = [];

        for (let pos = 0; pos < 81; pos++) {
            const cel = document.createElement("button");
            cel.type = "button";
            cel.className = "sudoku-celula";

            const lin = Math.floor(pos / 9);
            const col = pos % 9;

            if (col % 3 === 2 && col !== 8) cel.classList.add("borda-dir");
            if (lin % 3 === 2 && lin !== 8) cel.classList.add("borda-baixo");

            cel.addEventListener("click", () => {
                if (terminado) return;
                selecionada = pos;
                desenhar();
            });

            grade.appendChild(cel);
            celulas.push(cel);
        }
    }

    function montarTeclado() {
        teclado.replaceChildren();
        botoesNumero = [];

        for (let n = 1; n <= 9; n++) {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "sudoku-tecla";
            botao.textContent = n;
            botao.addEventListener("click", () => colocarNumero(n));
            teclado.appendChild(botao);
            botoesNumero.push(botao);
        }
    }

    function desenhar() {
        const valorSel = selecionada >= 0 ? atual[selecionada] : 0;

        for (let pos = 0; pos < 81; pos++) {
            const cel = celulas[pos];
            const v = atual[pos];

            cel.classList.toggle("fixa", inicial[pos] !== 0);
            cel.classList.toggle("errada", v !== 0 && v !== solucao[pos]);
            cel.classList.toggle("selecionada", pos === selecionada);
            cel.classList.toggle(
                "relacionada",
                selecionada >= 0 && pos !== selecionada && mesmaArea(pos, selecionada)
            );
            cel.classList.toggle(
                "mesmo-numero",
                valorSel !== 0 && v === valorSel && pos !== selecionada
            );

            if (v !== 0) {
                cel.textContent = v;
            } else if (notas[pos].size > 0) {
                const caixa = document.createElement("div");
                caixa.className = "sudoku-notas-grade";

                for (let n = 1; n <= 9; n++) {
                    const s = document.createElement("span");
                    s.textContent = notas[pos].has(n) ? n : "";
                    caixa.appendChild(s);
                }

                cel.replaceChildren(caixa);
            } else {
                cel.textContent = "";
            }
        }

        // Numero que ja tem os 9 no lugar certo fica apagado no teclado
        for (let n = 1; n <= 9; n++) {
            let certos = 0;
            for (let pos = 0; pos < 81; pos++) {
                if (atual[pos] === n && solucao[pos] === n) certos++;
            }
            botoesNumero[n - 1].classList.toggle("completo", certos === 9);
        }

        botaoNotas.classList.toggle("ativo", modoNotas);
        botaoNotas.textContent = modoNotas ? "✏️ LÁPIS ON" : "✏️ LÁPIS OFF";
    }

    // ========================================
    // JOGADAS
    // ========================================

    function podeEditar(pos) {
        return (
            !terminado &&
            pos >= 0 &&
            inicial[pos] === 0 &&
            atual[pos] !== solucao[pos]
        );
    }

    function limparNotasVizinhas(pos, n) {
        for (let i = 0; i < 81; i++) {
            if (i !== pos && mesmaArea(i, pos)) notas[i].delete(n);
        }
    }

    function colocarNumero(n) {
        if (!podeEditar(selecionada)) return;

        if (modoNotas) {
            if (atual[selecionada] !== 0) return;
            const s = notas[selecionada];
            if (s.has(n)) s.delete(n); else s.add(n);
            desenhar();
            return;
        }

        if (atual[selecionada] === n) return;

        atual[selecionada] = n;
        notas[selecionada].clear();

        if (n !== solucao[selecionada]) {
            erros++;
            placarErros.textContent = erros;
        } else {
            limparNotasVizinhas(selecionada, n);
        }

        desenhar();
        verificarFim();
    }

    function apagar() {
        if (!podeEditar(selecionada)) return;
        atual[selecionada] = 0;
        notas[selecionada].clear();
        desenhar();
    }

    function verificarFim() {
        for (let pos = 0; pos < 81; pos++) {
            if (atual[pos] !== solucao[pos]) return;
        }

        terminado = true;
        pararRelogio();

        const tempo = formatarTempo(Date.now() - inicio);
        selecionada = -1;
        desenhar();

        resultado.textContent =
            `🎉 Completou em ${tempo} com ${erros} ${erros === 1 ? "erro" : "erros"}!`;

        botaoDeNovo.hidden = false;
    }

    // ========================================
    // FLUXO DAS TELAS
    // ========================================

    function mostrarRegras() {
        pararRelogio();
        terminado = true;
        areaRegras.hidden = false;
        areaJogo.hidden = true;
        placar.hidden = true;
        botaoDeNovo.hidden = true;
        resultado.textContent = "";

        for (const b of botoesNivel) b.disabled = false;
    }

    function comecar(nivel) {
        if (!NIVEIS[nivel]) return;

        for (const b of botoesNivel) b.disabled = true;
        resultado.textContent = "Montando o tabuleiro...";

        // Pequena pausa para a mensagem aparecer antes de gerar
        setTimeout(() => {
            const { completo, puzzle } = gerar(nivel);

            solucao = completo;
            inicial = puzzle.slice();
            atual = puzzle.slice();
            notas = Array.from({ length: 81 }, () => new Set());

            selecionada = -1;
            modoNotas = false;
            erros = 0;
            terminado = false;

            placarNivel.textContent = NIVEIS[nivel].nome;
            placarErros.textContent = "0";

            areaRegras.hidden = true;
            areaJogo.hidden = false;
            placar.hidden = false;
            botaoDeNovo.hidden = true;
            resultado.textContent = "";

            montarGrade();
            desenhar();
            iniciarRelogio();
        }, 30);
    }

    for (const b of botoesNivel) {
        b.addEventListener("click", () => comecar(b.dataset.nivel));
    }

    botaoNotas.addEventListener("click", () => {
        modoNotas = !modoNotas;
        desenhar();
    });

    botaoApagar.addEventListener("click", apagar);
    botaoDeNovo.addEventListener("click", mostrarRegras);

    botaoAbrir.addEventListener("click", () => {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });
        telaSudoku.hidden = false;
        mostrarRegras();
    });

    botaoVoltar.addEventListener("click", () => {
        pararRelogio();
        terminado = true;
        telaSudoku.hidden = true;
        telaHabilidade.hidden = false;
    });

    // Teclado do PC (ajuda nos testes no VS Code)
    document.addEventListener("keydown", (e) => {
        if (telaSudoku.hidden || terminado) return;

        if (e.key >= "1" && e.key <= "9") {
            colocarNumero(Number(e.key));
        } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
            apagar();
        }
    });

    montarTeclado();
})();
