import React from 'react';
import { Cloud, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/AlertDialog';

export const GoogleDriveStatus: React.FC = () => {
  const { status, isLoading, isConnected, connect, disconnect, isConnecting, isDisconnecting } = useGoogleDrive();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Google Drive
        </CardTitle>
        <CardDescription>
          {isConnected ? 'Connected to your Google Drive account' : 'Connect to import files from Google Drive'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-foreground mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{status?.userInfo?.name || 'Connected'}</p>
                <p className="text-sm text-muted-foreground">{status?.userInfo?.email}</p>
              </div>
              {status?.userInfo?.picture && (
                <img
                  src={status.userInfo.picture}
                  alt={status.userInfo.name}
                  className="h-10 w-10 rounded-full"
                />
              )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isDisconnecting}
                  className="w-full"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the connection to your Google Drive account. You won't be able to import files from Google Drive until you reconnect.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => disconnect()}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-muted-foreground">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <p className="text-sm">
                Connect your Google Drive to easily import files into your data rooms.
              </p>
            </div>
            <Button 
              onClick={() => connect()} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  Connect Google Drive
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

