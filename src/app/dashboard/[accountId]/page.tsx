import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
    params: { accountId: string };
}

export default function AccountDetailPage({ params }: Props) {
    const { accountId } = params;
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Account {accountId}</CardTitle>
                        <CardDescription>Boilerplate account detail page</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">More details coming soon…</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


