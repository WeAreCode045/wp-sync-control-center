
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WPEnvironment {
  id: string;
  url: string;
  username: string;
  password: string;
}

interface SyncComponents {
  plugins: { selected: string[] };
  themes: { selected: string[] };
  database: { selected: string[] };
  media: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { sourceEnv, targetEnv, components, syncOperationId }: {
      sourceEnv: WPEnvironment;
      targetEnv: WPEnvironment;
      components: SyncComponents;
      syncOperationId: string;
    } = await req.json()

    console.log('Starting WordPress plugin-based sync operation:', syncOperationId)
    console.log('Source:', sourceEnv.url, 'Target:', targetEnv.url)

    // Validate URLs before proceeding
    if (!sourceEnv.url || !targetEnv.url) {
      throw new Error(`Missing URLs - Source: ${sourceEnv.url}, Target: ${targetEnv.url}`)
    }

    // Update sync operation status
    await updateSyncProgress(supabase, syncOperationId, 5, 'running', 'Plugin-based sync gestart...')

    // Prepare source authentication
    const sourceAuth = btoa(`${sourceEnv.username}:${sourceEnv.password}`)
    const targetAuth = btoa(`${targetEnv.username}:${targetEnv.password}`)

    let currentProgress = 10

    // First, get data from source environment using the plugin
    console.log('Fetching source environment data via plugin...')
    await updateSyncProgress(supabase, syncOperationId, currentProgress, 'running', 'Ophalen source data via plugin...')
    
    const sourceDataResponse = await fetch(`${sourceEnv.url}/wp-json/wp-sync-manager/v1/data`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${sourceAuth}`,
        'Content-Type': 'application/json'
      }
    })

    if (!sourceDataResponse.ok) {
      throw new Error(`Could not fetch source data: ${sourceDataResponse.status} ${sourceDataResponse.statusText}`)
    }

    const sourceData = await sourceDataResponse.json()
    console.log('Source data fetched successfully')
    
    currentProgress = 20
    await updateSyncProgress(supabase, syncOperationId, currentProgress, 'running', 'Source data opgehaald, starten sync...')

    // Prepare sync request payload with correct parameter names
    const syncPayload = {
      operation_type: 'pull', // We're always pulling from source to target
      components: components,
      target_url: sourceEnv.url, // This is the source URL for pull operations
      target_credentials: {
        username: sourceEnv.username,
        password: sourceEnv.password
      }
    }

    console.log('Sync payload:', JSON.stringify(syncPayload, null, 2))

    // Execute sync on target environment
    console.log('Executing sync on target environment via plugin...')
    await updateSyncProgress(supabase, syncOperationId, 30, 'running', 'Uitvoeren sync op target omgeving...')

    const syncResponse = await fetch(`${targetEnv.url}/wp-json/wp-sync-manager/v1/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${targetAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(syncPayload)
    })

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      throw new Error(`Sync operation failed: ${syncResponse.status} ${errorText}`)
    }

    const syncResult = await syncResponse.json()
    console.log('Sync operation completed:', syncResult)

    // Update progress based on sync results
    currentProgress = 80
    await updateSyncProgress(supabase, syncOperationId, currentProgress, 'running', 'Sync operatie voltooid, verwerken resultaten...')

    // Check if there were any failures in the sync
    let hasFailures = false
    let successCount = 0
    let totalCount = 0

    if (syncResult.details) {
      // Count successes and failures
      Object.values(syncResult.details).forEach((categoryResults: any) => {
        if (Array.isArray(categoryResults)) {
          categoryResults.forEach((result: any) => {
            totalCount++
            if (result.success) {
              successCount++
            } else {
              hasFailures = true
            }
          })
        } else if (categoryResults && typeof categoryResults === 'object') {
          // Handle single media result
          totalCount++
          if (categoryResults.success) {
            successCount++
          } else {
            hasFailures = true
          }
        }
      })
    }

    const finalMessage = hasFailures 
      ? `Sync voltooid met waarschuwingen (${successCount}/${totalCount} succesvol)`
      : `Sync succesvol voltooid (${successCount}/${totalCount} items)`

    // Complete sync
    await updateSyncProgress(supabase, syncOperationId, 100, 'completed', finalMessage)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Plugin-based sync completed successfully',
        results: syncResult,
        stats: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Plugin-based sync operation failed:', error)
    
    try {
      const { syncOperationId } = await req.json()
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      )
      
      await updateSyncProgress(supabase, syncOperationId, 0, 'failed', `Plugin-based sync mislukt: ${error.message}`)
    } catch (updateError) {
      console.error('Failed to update sync status:', updateError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function updateSyncProgress(supabase: any, syncOperationId: string, progress: number, status: string, message: string) {
  console.log(`Progress: ${progress}% - ${status} - ${message}`)
  
  try {
    const { error } = await supabase
      .from('sync_operations')
      .update({
        progress,
        status,
        ...(status === 'completed' && { completed_at: new Date().toISOString() }),
        ...(status === 'failed' && { error_message: message })
      })
      .eq('id', syncOperationId)

    if (error) {
      console.error('Failed to update sync progress:', error)
    }
  } catch (error) {
    console.error('Error updating sync progress:', error)
  }
}
