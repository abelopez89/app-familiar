import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Proximamente({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Próximamente. Este módulo todavía no está disponible.
        </p>
      </CardContent>
    </Card>
  );
}
