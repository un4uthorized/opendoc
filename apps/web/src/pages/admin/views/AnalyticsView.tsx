import { useState } from 'react';
import { Eye, Search, Users } from 'lucide-react';
import {
  Alert, Card, CardContent, CardHeader, EmptyState, MethodBadge, Skeleton, Sparkline, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  ToggleGroup, ToggleGroupItem, type HttpMethod,
} from '../../../design-system';
import { useAnalytics, type Period } from '../data/analytics';
import type { Project } from '../data/types';
import { PageHeader } from '../parts';

const periods: Array<{ value: Period; label: string }> = [{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }];

const number = (value: number) => value.toLocaleString('pt-BR', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 });
/** Change against the previous period; nothing to compare with when it had no visits. */
const trend = (current: number, previous: number) => {
  if (previous === 0) return undefined;
  const change = (current - previous) / previous;
  return { value: `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change * 100))}%`, trend: change >= 0 ? 'up' as const : 'down' as const };
};

/** How the published docs are used: views, visitors, searches and what is read most. */
export function AnalyticsView({ project }: { project: Project }) {
  const [period, setPeriod] = useState<Period>('30');
  const { data, error, loading } = useAnalytics(project.id, period);
  const published = project.versions.some((version) => version.publishedAt);

  return (
    <div className="admin-page">
      <PageHeader
        title="Analytics"
        description="Como a documentação publicada está sendo usada."
        actions={(
          <ToggleGroup type="single" value={period} onValueChange={(value) => value && setPeriod(value as Period)} aria-label="Período">
            {periods.map((item) => <ToggleGroupItem key={item.value} value={item.value} size="sm">{item.label}</ToggleGroupItem>)}
          </ToggleGroup>
        )}
      />

      {!published ? (
        <EmptyState icon={<Eye />} titleAs="h2" title="Nada publicado ainda" description="Os números aparecem depois que a primeira versão for publicada e receber visitas." />
      ) : error ? (
        <Alert variant="destructive" title="Não foi possível carregar os números">{error}</Alert>
      ) : !data ? (
        <div className="admin-stat-grid" aria-busy="true">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="admin-analytics-skeleton" />)}
        </div>
      ) : (
        <div className={loading ? 'admin-analytics is-loading' : 'admin-analytics'} aria-busy={loading}>
          <div className="admin-stat-grid">
            <StatCard
              icon={<Eye />}
              label="Visitas"
              value={number(data.visits)}
              delta={trend(data.visits, data.previousVisits)}
              description={data.previousVisits ? 'vs. período anterior' : 'páginas abertas na documentação'}
              chart={data.visits > 0
                ? <Sparkline data={data.daily.map((item) => item.views)} label={`Visitas por dia nos últimos ${period} dias, de ${data.daily[0]?.views ?? 0} a ${data.daily.at(-1)?.views ?? 0}`} />
                : undefined}
            />
            <StatCard
              icon={<Users />}
              label="Visitantes únicos"
              value={number(data.visitors)}
              description={data.visitors ? `${(data.visits / data.visitors).toFixed(1).replace('.', ',')} visitas por pessoa` : 'contados por dia, sem identificar ninguém'}
            />
            <StatCard
              icon={<Search />}
              label="Buscas"
              value={number(data.searches)}
              description={data.searches ? `${number(data.searchesWithoutResults)} sem resultado` : 'feitas no ⌘K da documentação'}
            />
          </div>

          {data.visits === 0 && data.searches === 0 ? (
            <EmptyState icon={<Eye />} titleAs="h2" title="Sem visitas nesse período" description="Assim que alguém abrir a documentação publicada, as visitas aparecem aqui." />
          ) : (
            <div className="admin-columns">
              <Card>
                <CardHeader title="Endpoints mais vistos" />
                <CardContent>
                  {data.endpoints.length === 0 ? <p className="admin-muted">Nenhum endpoint aberto nesse período.</p> : (
                    <Table label="Endpoints mais vistos">
                      <TableHeader><TableRow><TableHead>Endpoint</TableHead><TableHead align="right">Visitas</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.endpoints.map((endpoint) => (
                          <TableRow key={`${endpoint.method} ${endpoint.path}`}>
                            <TableCell><span className="admin-endpoint-cell" title={endpoint.label}><MethodBadge method={endpoint.method as HttpMethod} /><code>{endpoint.path}</code></span></TableCell>
                            <TableCell align="right">{number(endpoint.views)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="admin-stack">
                <Card>
                  <CardHeader title="Buscas sem resultado" description="Sinal do que falta documentar." />
                  <CardContent>
                    {data.missedSearches.length === 0 ? <p className="admin-muted">Toda busca encontrou algo nesse período.</p> : (
                      <ul role="list" className="admin-rank-list">
                        {data.missedSearches.map((item) => <li key={item.term}><span>“{item.term}”</span><span className="admin-muted">{number(item.count)}</span></li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="Páginas mais lidas" />
                  <CardContent>
                    {data.pages.length === 0 ? <p className="admin-muted">Nenhuma página do wiki aberta nesse período.</p> : (
                      <ul role="list" className="admin-rank-list">
                        {data.pages.map((page) => <li key={page.page}><span>{page.title}</span><span className="admin-muted">{number(page.views)}</span></li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
