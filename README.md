# Redator de Atas FEPESCA

Aplicação web estática para organizar reuniões da FEPESCA, registrar presenças, estruturar pautas e informes, gerar texto institucional de ata e exportar em DOCX.

## Funcionalidades

- Cadastro e controle de presenças
- Registro de pautas, informes e transcrição
- Geração de ata institucional
- Exportação da sessão em JSON
- Exportação da ata em DOCX
- Geração de CSV de presenças
- Geração de apresentação em PPTX

## Como usar

1. Abra o arquivo `index.html` no navegador.
2. Preencha os dados da reunião.
3. Revise a prévia da ata.
4. Exporte em DOCX ou salve a sessão em JSON.

## Troca com o diretor

1. Antes de enviar qualquer coisa, clique em `Salvar Sessão`.
2. Envie o JSON da sessão ao diretor.
3. Quando ele devolver, salve primeiro a sua versão atual.
4. Se ele devolveu a reunião inteira, use `Abrir Sessão`.
5. Se ele devolveu só pautas ou informes, use `Mesclar JSON` na aba correspondente.
6. Depois de carregar, revise a ata, gere o DOCX e só então envie para a IA final.

## Publicação online

Este projeto pode ser publicado diretamente no GitHub Pages, sem build e sem servidor.
