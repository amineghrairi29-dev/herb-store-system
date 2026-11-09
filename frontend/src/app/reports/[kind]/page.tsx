import { notFound } from 'next/navigation';
import { isReportKind, reportCatalog } from '@/types/report';
import ReportPage from '../report-page';
export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) { const { kind } = await params; return { title: isReportKind(kind) ? reportCatalog[kind].title : 'Rapport introuvable' }; }
export default async function Page({ params }: { params: Promise<{ kind: string }> }) { const { kind } = await params; if (!isReportKind(kind)) notFound(); return <ReportPage key={kind} kind={kind} />; }
