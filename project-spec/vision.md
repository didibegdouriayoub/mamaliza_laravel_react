# Vision — Fromagerie Management System

## Project Overview

**Fromagerie** is a full-stack management system for an artisanal cheese factory. It provides end-to-end traceability from raw material procurement, through production and quality control, to sales and delivery.

## Problem Statement

Artisanal cheese factories typically manage operations through paper records and spreadsheets. This leads to:

- **Inventory blind spots:** no real-time view of stock levels or low-stock alerts
- **Recipe drift:** recipe changes go untracked; there is no version history
- **Production opacity:** batch progress and operator accountability are informal
- **Quality gaps:** quality evaluations are not linked back to batch data
- **Sales fragmentation:** orders, payments, and returns are tracked separately
- **Manual cost estimation:** planning a production run requires manual calculation

## Solution

A web-based management platform with role-based access control, covering:

1. **Inventory management** with supplier tracking, history audit, and date-in-time stock queries
2. **Recipe management** with versioned ingredients, steps, and cost calculation
3. **Batch tracking** with Kanban/table views, status workflows, and material deduction
4. **Quality control** linked to batches with scored evaluation and approval/rejection
5. **Sales management** with order creation, multi-payment tracking, and returns
6. **Production logging** for real output, leftovers, and operator accountability
7. **Analytics dashboards** with live KPIs, revenue trends, and batch performance
8. **Cost estimation** tool to plan material needs and costs before starting production

## Users

| Role | Responsibilities |
|---|---|
| **Admin** | Full access: users, inventory, recipes, batches, sales, analytics |
| **Supervisor** | Inventory, recipes, batches, quality, analytics — no user management |
| **Operator** | Batches and quality only |

## Goals

- Replace all paper/spreadsheet workflows with a single system
- Provide real-time inventory accuracy driven by production events
- Create a full audit trail for every change to recipes and inventory
- Enable data-driven decisions through live analytics
- Scale to multiple operators working concurrently via a real backend API

## Non-Goals (v1)

- Multi-tenant / multi-factory support
- Mobile native app (responsive web only)
- Third-party accounting or ERP integration
- e-Commerce / customer-facing portal
