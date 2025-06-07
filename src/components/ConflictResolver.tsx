
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Database, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ConflictResolverProps {
  conflicts: any;
  onResolve: () => void;
  onCancel: () => void;
}

const ConflictResolver = ({ conflicts, onResolve, onCancel }: ConflictResolverProps) => {
  const { toast } = useToast();
  const [resolutions, setResolutions] = React.useState<Record<string, string>>({});
  const [isResolving, setIsResolving] = React.useState(false);

  const handleResolutionChange = (conflictId: string, resolution: string) => {
    setResolutions(prev => ({
      ...prev,
      [conflictId]: resolution
    }));
  };

  const handleResolveConflicts = async () => {
    console.log('Resolving conflicts with choices:', resolutions);
    setIsResolving(true);

    // Simulate conflict resolution
    setTimeout(() => {
      setIsResolving(false);
      toast({
        title: "Conflicts Resolved",
        description: "Database synchronization completed successfully.",
      });
      onResolve();
    }, 2000);
  };

  const allConflictsResolved = conflicts?.newRows?.every((row: any, index: number) => 
    resolutions[`new-${index}`]
  ) && conflicts?.updatedRows?.every((row: any, index: number) => 
    resolutions[`updated-${index}`]
  );

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-orange-600" />
            Database Conflicts Detected
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            The following conflicts were detected when comparing development and live databases. 
            Please choose how to handle each conflict:
          </p>

          {conflicts?.newRows && conflicts.newRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New Rows in Development</CardTitle>
                <CardDescription>
                  These rows exist in development but not in the live database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {conflicts.newRows.map((row: any, index: number) => (
                  <div key={index} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{row.table}</h4>
                        <p className="text-sm text-muted-foreground">{row.description}</p>
                      </div>
                      <Badge variant="secondary">{row.count} rows</Badge>
                    </div>
                    
                    <RadioGroup
                      value={resolutions[`new-${index}`] || ''}
                      onValueChange={(value) => handleResolutionChange(`new-${index}`, value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="push" id={`new-${index}-push`} />
                        <Label htmlFor={`new-${index}-push`} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-red-600" />
                          Push new rows from dev to live
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id={`new-${index}-skip`} />
                        <Label htmlFor={`new-${index}-skip`}>
                          Skip these rows (keep only in dev)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {conflicts?.updatedRows && conflicts.updatedRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Updated Rows</CardTitle>
                <CardDescription>
                  These rows have been modified in development and differ from live
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {conflicts.updatedRows.map((row: any, index: number) => (
                  <div key={index} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{row.table}</h4>
                        <p className="text-sm text-muted-foreground">{row.description}</p>
                      </div>
                      <Badge variant="secondary">{row.count} rows</Badge>
                    </div>
                    
                    <RadioGroup
                      value={resolutions[`updated-${index}`] || ''}
                      onValueChange={(value) => handleResolutionChange(`updated-${index}`, value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="push" id={`updated-${index}-push`} />
                        <Label htmlFor={`updated-${index}-push`} className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-red-600" />
                          Overwrite live with dev changes
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pull" id={`updated-${index}-pull`} />
                        <Label htmlFor={`updated-${index}-pull`} className="flex items-center gap-2">
                          <ArrowLeft className="h-4 w-4 text-blue-600" />
                          Keep live version (overwrite dev)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id={`updated-${index}-skip`} />
                        <Label htmlFor={`updated-${index}-skip`}>
                          Skip these rows (no changes)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onCancel} disabled={isResolving}>
              Cancel Push
            </Button>
            <Button
              onClick={handleResolveConflicts}
              disabled={!allConflictsResolved || isResolving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResolving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resolving...
                </>
              ) : (
                'Apply Resolution & Continue Push'
              )}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConflictResolver;
