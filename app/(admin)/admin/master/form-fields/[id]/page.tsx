import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getFormFieldById } from '@/lib/services/master-form-fields';
import { getProductCategories } from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { FormFieldEditor } from '../_components/form-field-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '폼 필드 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function FormFieldEditPage({ params }: { params: Params }) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const [item, products] = await Promise.all([
    getFormFieldById(id),
    getProductCategories(),
  ]);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`폼 필드 편집 — ${item.label}`}
        breadcrumb={
          <Link
            href="/admin/master/form-fields"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 접수 폼 필드
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <FormFieldEditor item={item} productCodes={products.map((p) => p.code)} />
        </CardContent>
      </Card>
    </div>
  );
}
