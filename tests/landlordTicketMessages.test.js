import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { landlordRouter } from '../landlordRoutes.js';

const mockConfig = {};

vi.mock('../authMiddleware.js', () => ({
  requireLandlord: (req, _res, next) => {
    req.landlordId = 77;
    next();
  },
}));

vi.mock('../supabaseClient.js', () => ({
  supabase: {
    from: (table) => {
      if (!mockConfig[table]) {
        throw new Error(`No mock configured for table ${table}`);
      }
      return mockConfig[table]();
    },
  },
}));

describe('landlord ticket messages', () => {
  let app;

  beforeEach(() => {
    for (const key of Object.keys(mockConfig)) {
      delete mockConfig[key];
    }
    app = express();
    app.use(express.json());
    app.use(landlordRouter);
  });

  it('returns messages for landlord-owned ticket', async () => {
    const messages = [{ id: 1, sender_type: 'tenant', message: 'Hi', created_at: '2025-01-01T00:00:00Z' }];

    mockConfig.tickets = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: { id: 10, landlord_id: 77, property_id: 99 },
          error: null,
        })),
      };
      return builder;
    };

    mockConfig.ticket_messages = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(async () => ({ data: messages, error: null })),
      };
      return builder;
    };

    const res = await request(app).get('/tickets/10/messages');
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].message).toBe('Hi');
  });

  it('returns 404 when ticket is not owned by landlord', async () => {
    mockConfig.tickets = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: { id: 11, landlord_id: 5 },
          error: null,
        })),
      };
      return builder;
    };

    const res = await request(app).get('/tickets/11/messages');
    expect(res.status).toBe(404);
  });

  it('creates a landlord reply', async () => {
    const inserted = [];

    mockConfig.tickets = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: { id: 12, landlord_id: 77 },
          error: null,
        })),
      };
      return builder;
    };

    mockConfig.ticket_messages = () => {
      const builder = {
        insert: vi.fn((payload) => {
          inserted.push(payload);
          return { error: null };
        }),
      };
      return builder;
    };

    const res = await request(app)
      .post('/tickets/12/messages')
      .send({ message: 'Landlord reply' });

    expect(res.status).toBe(201);
    expect(inserted[0]).toMatchObject({
      ticket_id: 12,
      sender_type: 'landlord',
      sender_id: 77,
      message: 'Landlord reply',
    });
  });
});
