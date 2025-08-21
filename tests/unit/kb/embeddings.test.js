import { EmbeddingManager } from '../../../src/kb/embeddings.ts';

// Mock @xenova/transformers
const mockPipeline = jest.fn();
jest.mock('@xenova/transformers', () => ({
    pipeline: jest.fn(() => mockPipeline)
}));

describe('EmbeddingManager', () => {
    let embeddingManager;
    const mockConfig = {
        modelName: 'Xenova/all-MiniLM-L6-v2',
        batchSize: 5,
        maxTokens: 512,
        enabled: true
    };

    beforeEach(() => {
        embeddingManager = new EmbeddingManager(mockConfig);
        mockPipeline.mockClear();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize successfully when enabled', async () => {
            const { pipeline } = await import('@xenova/transformers');
            pipeline.mockResolvedValueOnce(mockPipeline);

            await embeddingManager.initialize();

            expect(pipeline).toHaveBeenCalledWith(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2',
                expect.objectContaining({ quantized: true })
            );
            expect(embeddingManager.isReady()).toBe(true);
        });

        test('should not initialize when disabled', async () => {
            const disabledManager = new EmbeddingManager({ ...mockConfig, enabled: false });
            const { pipeline } = await import('@xenova/transformers');
            
            await disabledManager.initialize();

            expect(pipeline).not.toHaveBeenCalled();
            expect(disabledManager.isReady()).toBe(false);
        });

        test('should handle initialization errors', async () => {
            const { pipeline } = await import('@xenova/transformers');
            pipeline.mockRejectedValueOnce(new Error('Model load failed'));

            await expect(embeddingManager.initialize()).rejects.toThrow('Model load failed');
        });
    });

    describe('generateEmbedding', () => {
        beforeEach(async () => {
            const { pipeline } = await import('@xenova/transformers');
            pipeline.mockResolvedValueOnce(mockPipeline);
            await embeddingManager.initialize();
        });

        test('should generate embedding for text', async () => {
            const mockEmbedding = { data: new Float32Array([0.1, 0.2, 0.3, 0.4]) };
            mockPipeline.mockResolvedValueOnce(mockEmbedding);

            const result = await embeddingManager.generateEmbedding('Test text');

            expect(mockPipeline).toHaveBeenCalledWith('Test text', {
                pooling: 'mean',
                normalize: true
            });
            expect(result).toHaveLength(4);
            expect(result[0]).toBeCloseTo(0.1, 1);
            expect(result[1]).toBeCloseTo(0.2, 1);
        });

        test('should truncate long text', async () => {
            const longText = 'word '.repeat(1000); // Very long text
            const mockEmbedding = { data: new Float32Array([0.1, 0.2]) };
            mockPipeline.mockResolvedValueOnce(mockEmbedding);

            await embeddingManager.generateEmbedding(longText);

            // Verify that the text passed to pipeline is shorter
            const callArgs = mockPipeline.mock.calls[0][0];
            expect(callArgs.length).toBeLessThan(longText.length);
        });

        test('should handle embedding generation errors', async () => {
            mockPipeline.mockRejectedValueOnce(new Error('Embedding failed'));

            await expect(embeddingManager.generateEmbedding('Test text')).rejects.toThrow('Embedding failed');
        });
    });

    describe('generateEmbeddings', () => {
        beforeEach(async () => {
            const { pipeline } = await import('@xenova/transformers');
            pipeline.mockResolvedValueOnce(mockPipeline);
            await embeddingManager.initialize();
        });

        test('should generate embeddings for multiple texts', async () => {
            const mockEmbedding1 = { data: new Float32Array([0.1, 0.2]) };
            const mockEmbedding2 = { data: new Float32Array([0.3, 0.4]) };
            mockPipeline
                .mockResolvedValueOnce(mockEmbedding1)
                .mockResolvedValueOnce(mockEmbedding2);

            const texts = ['Text 1', 'Text 2'];
            const result = await embeddingManager.generateEmbeddings(texts);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveLength(2);
            expect(result[0][0]).toBeCloseTo(0.1, 1);
            expect(mockPipeline).toHaveBeenCalledTimes(2);
        });

        test('should process texts in batches', async () => {
            // Set small batch size for testing
            const batchManager = new EmbeddingManager({ ...mockConfig, batchSize: 2 });
            const { pipeline } = await import('@xenova/transformers');
            pipeline.mockResolvedValueOnce(mockPipeline);
            await batchManager.initialize();

            const mockEmbedding = { data: new Float32Array([0.1, 0.2]) };
            mockPipeline.mockResolvedValue(mockEmbedding);

            const texts = ['Text 1', 'Text 2', 'Text 3'];
            await batchManager.generateEmbeddings(texts);

            expect(mockPipeline).toHaveBeenCalledTimes(3);
        });
    });

    describe('calculateCosineSimilarity', () => {
        test('should calculate correct cosine similarity', () => {
            const embedding1 = [1, 0, 0];
            const embedding2 = [0, 1, 0];
            
            const similarity = embeddingManager.calculateCosineSimilarity(embedding1, embedding2);
            expect(similarity).toBe(0); // Perpendicular vectors
        });

        test('should calculate similarity for identical vectors', () => {
            const embedding1 = [1, 2, 3];
            const embedding2 = [1, 2, 3];
            
            const similarity = embeddingManager.calculateCosineSimilarity(embedding1, embedding2);
            expect(similarity).toBeCloseTo(1, 5); // Identical vectors
        });

        test('should handle zero vectors', () => {
            const embedding1 = [0, 0, 0];
            const embedding2 = [1, 2, 3];
            
            const similarity = embeddingManager.calculateCosineSimilarity(embedding1, embedding2);
            expect(similarity).toBe(0);
        });

        test('should throw error for mismatched dimensions', () => {
            const embedding1 = [1, 2];
            const embedding2 = [1, 2, 3];
            
            expect(() => {
                embeddingManager.calculateCosineSimilarity(embedding1, embedding2);
            }).toThrow('Embeddings must have the same dimensions');
        });
    });

    describe('findMostSimilar', () => {
        test('should find most similar documents', () => {
            const queryEmbedding = [1, 0, 0];
            const documents = [
                {
                    id: 'doc1',
                    path: 'doc1.md',
                    title: 'Document 1',
                    content: 'Content 1',
                    embedding: [1, 0, 0], // Identical
                    metadata: { created: 1, modified: 1, size: 100, tags: [], links: [] }
                },
                {
                    id: 'doc2',
                    path: 'doc2.md',
                    title: 'Document 2',
                    content: 'Content 2',
                    embedding: [0, 1, 0], // Perpendicular
                    metadata: { created: 2, modified: 2, size: 100, tags: [], links: [] }
                },
                {
                    id: 'doc3',
                    path: 'doc3.md',
                    title: 'Document 3',
                    content: 'Content 3',
                    embedding: [0.7, 0.7, 0], // Similar
                    metadata: { created: 3, modified: 3, size: 100, tags: [], links: [] }
                }
            ];

            const results = embeddingManager.findMostSimilar(queryEmbedding, documents, 2, 0.5);

            expect(results).toHaveLength(2);
            expect(results[0].document.id).toBe('doc1'); // Most similar
            expect(results[0].similarity).toBeCloseTo(1, 5);
            expect(results[1].document.id).toBe('doc3'); // Second most similar
            expect(results[1].similarity).toBeGreaterThan(0.5);
        });

        test('should filter by threshold', () => {
            const queryEmbedding = [1, 0, 0];
            const documents = [
                {
                    id: 'doc1',
                    path: 'doc1.md',
                    title: 'Document 1',
                    content: 'Content 1',
                    embedding: [0, 1, 0], // Similarity = 0
                    metadata: { created: 1, modified: 1, size: 100, tags: [], links: [] }
                }
            ];

            const results = embeddingManager.findMostSimilar(queryEmbedding, documents, 10, 0.5);

            expect(results).toHaveLength(0); // Filtered out by threshold
        });
    });

    describe('configuration updates', () => {
        test('should update configuration', () => {
            embeddingManager.updateConfig({ batchSize: 10 });
            
            const modelInfo = embeddingManager.getModelInfo();
            expect(modelInfo.batchSize).toBe(10);
        });

        test('should reset initialization when enabling', () => {
            const disabledManager = new EmbeddingManager({ ...mockConfig, enabled: false });
            
            expect(disabledManager.isReady()).toBe(false);
            
            disabledManager.updateConfig({ enabled: true });
            
            expect(disabledManager.isReady()).toBe(false); // Should reset
        });
    });

    describe('getModelInfo', () => {
        test('should return model information', () => {
            const info = embeddingManager.getModelInfo();
            
            expect(info).toEqual({
                modelName: 'Xenova/all-MiniLM-L6-v2',
                isReady: false,
                batchSize: 5
            });
        });
    });
});