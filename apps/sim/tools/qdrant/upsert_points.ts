import type { ToolConfig } from '../types'
import type { QdrantResponse, QdrantUpsertParams } from './types'

export const upsertPointsTool: ToolConfig<QdrantUpsertParams, QdrantResponse> = {
  id: 'qdrant_upsert',
  name: 'Qdrant Upsert Points',
  description: 'Insert or update points in a Qdrant collection',
  version: '1.0',

  params: {
    url: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Qdrant base URL',
    },
    apiKey: {
      type: 'string',
      required: false,
      description: 'Qdrant API key (optional)',
    },
    collection: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Collection name',
    },
    points: {
      type: 'array',
      required: true,
      description: 'Array of points to upsert',
    },
  },

  request: {
    method: 'PUT',
    url: (params) => `${params.url.replace(/\/$/, '')}/collections/${params.collection}/points`,
    headers: (params) => ({
      'Content-Type': 'application/json',
      ...(params.apiKey ? { 'api-key': params.apiKey } : {}),
    }),
    body: (params) => ({ points: params.points }),
  },

  transformResponse: async (response) => {
    const data = await response.json()
    return {
      success: response.ok && data.status === 'ok',
      output: {
        status: data.status,
        data: data.result,
      },
    }
  },
}
