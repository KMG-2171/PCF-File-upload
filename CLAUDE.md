# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Power Apps Component Framework (PCF) project for creating a custom file upload control. The project uses TypeScript and follows Microsoft's PCF development patterns.

## Development Commands

### Build and Development
- `npm run build` - Build the PCF control
- `npm run start` - Start development server
- `npm run start:watch` - Start development server with watch mode
- `npm run clean` - Clean build artifacts
- `npm run rebuild` - Clean and rebuild the project

### Code Quality
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and auto-fix issues
- `npm run refreshTypes` - Refresh TypeScript type definitions

## Project Structure

- `customFileUpload/` - Main control implementation directory
  - `index.ts` - Control implementation class
  - `ControlManifest.Input.xml` - Control manifest defining properties and metadata
  - `generated/` - Auto-generated TypeScript type definitions
- `pcfconfig.json` - PCF configuration (output directory)
- `mahfooz.pcfproj` - MSBuild project file for Visual Studio integration
- `tsconfig.json` - TypeScript configuration extending PCF base config
- `eslint.config.mjs` - ESLint configuration with Microsoft Power Apps rules

## Architecture

This is a standard PCF control implementing the `ComponentFramework.StandardControl` interface:

- **Control Class**: `customFileUpload` in `customFileUpload/index.ts`
- **Manifest**: Defines control properties, features, and resource dependencies
- **Context**: Uses ComponentFramework context for data binding and utilities
- **Outputs**: Implements `getOutputs()` for data return to host application

The control currently has a basic structure with placeholder implementations in the standard PCF lifecycle methods:
- `init()` - Control initialization
- `updateView()` - View updates when data changes
- `getOutputs()` - Return data to host
- `destroy()` - Cleanup on control removal

## Build System

The project uses Microsoft's PCF build toolchain:
- TypeScript compilation with strict type checking
- ESLint with Microsoft Power Apps specific rules
- Output directory: `out/controls/`
- Supports .NET Framework 4.6.2 for Visual Studio integration

## Document Refrence
https://learn.microsoft.com/en-us/power-apps/developer/component-framework/implementing-controls-using-typescript?tabs=before