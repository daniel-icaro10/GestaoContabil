import { money, pct } from './format';
import {
  baseCreditos,
  fatorR,
  menorCarga,
  resultadoOperacional,
  resumoRegimes,
  soma,
  totalFolha,
  type CompanyData,
  type Resultados,
  type TaxConfig,
} from './tax';

export interface PontoAtencao {
  tipo: 'alerta' | 'info' | 'ok';
  texto: string;
}

/** Monta indicadores, conclusões e pontos de atenção usados no Diagnóstico e no Relatório. */
export function montarDiagnostico(d: CompanyData, r: Resultados, cfg: TaxConfig) {
  const res = resultadoOperacional(d.faturamento, d.custos, d.folha);
  const fr = fatorR(d.folha, d.faturamento);
  const receita = soma(d.faturamento.meses);
  const folha = totalFolha(d.folha);
  const folhaRatio = receita > 0 ? folha / receita : 0;
  const creditos = baseCreditos(d.creditos);
  const t = d.empresa;
  const anexoIII = fr >= cfg.fatorRLimite;

  const indicadores = [
    { label: 'Faturamento anual', value: money(receita), sub: `Média: ${money(receita / 12)}/mês` },
    { label: 'Margem operacional', value: pct(res.margem * 100), sub: money(res.resultado) },
    { label: 'Folha / faturamento', value: pct(folhaRatio * 100), sub: money(folha) },
    { label: 'Fator R', value: pct(fr * 100), sub: anexoIII ? 'Anexo III' : 'Anexo V' },
    { label: 'Total de custos', value: money(res.totalCustos), sub: pct(receita > 0 ? (res.totalCustos / receita) * 100 : 0) },
    { label: 'Total de despesas', value: money(res.totalDespesas), sub: pct(receita > 0 ? (res.totalDespesas / receita) * 100 : 0) },
    { label: 'Base de créditos', value: money(creditos), sub: 'PIS/COFINS anual' },
    { label: 'Regime atual', value: t.regimeAtual, sub: t.tipoAtividade },
  ];

  const conclusoes = [
    `A empresa apresenta margem operacional estimada de ${pct(res.margem * 100)}.`,
    `A folha de pagamento representa ${pct(folhaRatio * 100)} do faturamento anual.`,
    `O Fator R calculado foi de ${pct(fr * 100)}, ${anexoIII ? 'favorecendo o enquadramento no Anexo III do Simples Nacional' : 'indicando enquadramento no Anexo V para atividades de serviço'}.`,
    res.totalDespesas > 0 &&
      `O volume de despesas dedutíveis (${money(res.totalDespesas)}) pode ter impacto relevante na apuração do Lucro Real.`,
    creditos > 0 &&
      `A empresa possui bases de créditos tributários de ${money(creditos)}, que reduzem a carga líquida de PIS e COFINS no Lucro Real.`,
    `O Lucro Presumido apresentou carga tributária estimada de ${pct(r.presumido.cargaTributaria * 100)} sobre o faturamento.`,
    `O Simples Nacional apresentou alíquota efetiva de ${pct(r.simples.aliquotaEfetiva * 100)}, enquadramento no ${r.simples.anexo}.`,
    `O Lucro Real apresentou carga tributária de ${pct(r.real.cargaTributaria * 100)}, considerando os créditos de PIS e COFINS.`,
  ].filter(Boolean) as string[];

  const pontos: PontoAtencao[] = [];
  if (receita > cfg.simplesLimite * 0.9)
    pontos.push({ tipo: 'alerta', texto: `Faturamento próximo ao limite do Simples Nacional (${money(cfg.simplesLimite)}). Planejamento preventivo é recomendado.` });
  if (!anexoIII && (t.tipoAtividade === 'Serviços' || t.tipoAtividade === 'Atividades Mistas'))
    pontos.push({ tipo: 'alerta', texto: `Fator R abaixo de 28% (${pct(fr * 100)}). Empresa de serviços será enquadrada no Anexo V, com alíquotas mais elevadas.` });
  if (res.margem < 0.05)
    pontos.push({ tipo: 'alerta', texto: `Margem operacional reduzida (${pct(res.margem * 100)}). Avaliar viabilidade do Lucro Real com base no resultado efetivo.` });
  if (folhaRatio > 0.35)
    pontos.push({ tipo: 'alerta', texto: `Folha de pagamento elevada (${pct(folhaRatio * 100)} do faturamento). Verificar impacto do INSS Patronal nos regimes de Lucro Presumido e Real.` });
  if (t.atividadeEspecifica !== 'Não')
    pontos.push({ tipo: 'info', texto: `Atividade com regime específico: ${t.atividadeEspecifica}. Verifique as regras tributárias diferenciadas aplicáveis.` });
  if (creditos > 0) pontos.push({ tipo: 'ok', texto: `Empresa possui base de créditos PIS/COFINS de ${money(creditos)}, aplicável no Lucro Real.` });
  if (r.real.totalAnual < r.presumido.totalAnual)
    pontos.push({ tipo: 'info', texto: 'O Lucro Real apresentou carga estimada inferior ao Lucro Presumido, considerando os créditos tributários.' });
  if (receita < cfg.simples['Anexo I - Comércio'].faixas[1].limite)
    pontos.push({ tipo: 'ok', texto: 'Faturamento na 1ª ou 2ª faixa do Simples Nacional — alíquotas mais reduzidas.' });
  const adicional = r.presumido.adicionalIrpjMensal * 12;
  if (adicional > 0)
    pontos.push({ tipo: 'info', texto: `Incidência do adicional de IRPJ (${pct(cfg.presumido.adicionalIrpj * 100, 0)}) estimada em ${money(adicional)}/ano no Lucro Presumido.` });

  const regimes = resumoRegimes(r);
  const melhor = menorCarga(regimes);
  const atual = regimes.find((x) => x.name === t.regimeAtual);
  const economia = atual ? atual.anual - melhor.anual : 0;

  return { res, fr, receita, folha, folhaRatio, indicadores, conclusoes, pontos, regimes, melhor, atual, economia };
}
