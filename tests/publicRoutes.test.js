import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { publicRouter } from '../publicRoutes.js';

const mockConfig = {};

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

describe('publicRoutes', () => {
  let app;

  beforeEach(() => {
    for (const key of Object.keys(mockConfig)) {
      delete mockConfig[key];
    }
    app = express();
    app.use(express.json());
    app.use(publicRouter);
  });

  it('returns active listings with property/unit data', async () => {
    const listings = [
      { id: 1, property_id: 10, unit_id: 100, title: 'Unit A', description: 'Nice', rent_amount: 5000, is_active: true },
      { id: 2, property_id: 11, unit_id: 101, title: 'Unit B', description: 'Cozy', rent_amount: 6000, is_active: false },
    ];
    const properties = [{ id: 10, name: 'Main Plaza', location: 'CBD' }];
    const units = [{ id: 100, unit_code: 'A1', type: '1br', base_rent: 5000 }];

    mockConfig.public_listings = () => {
      const filters = {};
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((key, value) => {
          filters[key] = value;
          return builder;
        }),
        order: vi.fn(async () => {
          const filtered = listings.filter((l) => {
            if (filters.is_active !== undefined && l.is_active !== filters.is_active) return false;
            if (filters.property_id && l.property_id !== filters.property_id) return false;
            return true;
          });
          return { data: filtered, error: null };
        }),
      };
      return builder;
    };

    mockConfig.properties = () => {
      const builder = {
        select: vi.fn(() => builder),
        in: vi.fn(async (_field, ids) => ({
          data: properties.filter((p) => ids.includes(p.id)),
          error: null,
        })),
      };
      return builder;
    };

    mockConfig.units = () => {
      const builder = {
        select: vi.fn(() => builder),
        in: vi.fn(async (_field, ids) => ({
          data: units.filter((u) => ids.includes(u.id)),
          error: null,
        })),
      };
      return builder;
    };

    const res = await request(app).get('/listings');
    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(1);
    expect(res.body.listings[0].property.name).toBe('Main Plaza');
    expect(res.body.listings[0].unit.unit_code).toBe('A1');

    const filtered = await request(app).get('/listings?propertyId=999');
    expect(filtered.status).toBe(200);
    expect(filtered.body.listings).toHaveLength(0);
  });

  it('creates applications for active listings', async () => {
    const inserted = [];

    mockConfig.public_listings = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: { id: 5, property_id: 77, unit_id: 88, is_active: true },
          error: null,
        })),
      };
      return builder;
    };

    mockConfig.applications = () => {
      const builder = {
        insert: vi.fn((payload) => {
          inserted.push(payload);
          return builder;
        }),
        select: vi.fn(() => builder),
        single: vi.fn(async () => ({ data: { id: 123 }, error: null })),
      };
      return builder;
    };

    const res = await request(app)
      .post('/applications')
      .send({ listingId: 5, fullName: 'Jane', phone: '555', monthlyIncome: 12000, notes: 'prefers mornings' });

    expect(res.status).toBe(201);
    expect(res.body.applicationId).toBe(123);
    expect(inserted[0]).toMatchObject({
      property_id: 77,
      unit_id: 88,
      full_name: 'Jane',
      phone: '555',
      monthly_income: 12000,
      notes: 'prefers mornings',
    });
  });

  it('rejects inactive listings', async () => {
    mockConfig.public_listings = () => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: { id: 6, property_id: 1, unit_id: 2, is_active: false },
          error: null,
        })),
      };
      return builder;
    };

    const res = await request(app)
      .post('/applications')
      .send({ listingId: 6, fullName: 'Inactive', phone: '000' });

    expect(res.status).toBe(404);
  });
});
