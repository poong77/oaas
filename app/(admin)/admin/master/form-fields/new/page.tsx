import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getProductCategories } from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { FormFieldEditor } from '../_components/form-field-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 폼 필드 — 마스터DB' };

export default async function NewFormFieldPage() {
  await requireRole(['manager', 'admin']);
  const products = await getProductCategories();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 폼 필드"
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
          <FormFieldEditor productCodes={products.map((p) => p.code)} />
        </CardContent>
      </Card>
    </div>
  );
}
