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

## Fluxo com IA e transcrição

1. Durante a reunião, preencha os campos telegráficos de `Pautas` e `Informes` na ordem das falas.
2. Após a reunião, obtenha o resumo da transcrição gerado pela IA a partir do áudio.
3. Cole esse resumo na aba `Transcrição`, para manter o registro de apoio dentro da sessão.
4. Vá para a aba `Ata` e clique em `Gerar texto base`.
5. Revise a prévia da ata e, em seguida, clique em `Baixar DOCX`.
6. Clique em `Copiar prompt IA`.
7. Para a IA final, envie em conjunto: o DOCX gerado, o prompt copiado e o resumo da transcrição.
8. Use o DOCX como base institucional, os textos telegráficos como estrutura do debate e o resumo da transcrição como apoio factual.
9. Depois que a IA devolver a versão final, revise nomes, cargos, decisões, responsáveis, prazos e votações antes de circular o documento.

## Publicação online

Este projeto pode ser publicado diretamente no GitHub Pages, sem build e sem servidor.
