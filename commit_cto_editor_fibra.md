feat: corrige offset na manipulação e criação de pontos da fibra e resolve conflitos da grade livre

- Refatorado `screenToCanvas` para utilizar `viewStateRef.current` ao invés de closure desatualizada de `viewState`, mitigando distorções de coordenadas depois da movimentação (pan) ou zoom na tela.
- Implementado cálculo dinâmico de diferença (`offsetX` e `offsetY`) do ponto exato onde houve o clique do mouse e do respectivo ponto visual entre a fibra (`handlePathMouseDown` e `handlePointMouseDown`).
- Aplicados deslocamentos dinâmicos dentro do movimento livre do cursor (`handleMouseMove`) para que a fibra obedeça milimetricamente com a tolerância de hitbox de largura de clique.
- Ajustado o estado final ao soltar o mouse (`handleMouseUp`), aplicando exatamente os mesmos offsets durante o salvamento das coordenadas, permitindo que a movimentação seja livre e precisa quando o "Ajustar à grade" estiver desmarcado.
