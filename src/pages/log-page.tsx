import { PageHeader } from '@/components/common/page-header';
import { LogViewer } from '@/features/system';

export default function LogPage() {
    return (
        <>
            <PageHeader
                title="Log"
                description="Tail of the live engine's Python log, newest first."
            />
            <LogViewer />
        </>
    );
}
