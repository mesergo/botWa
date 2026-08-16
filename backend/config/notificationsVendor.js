/**
 * Shared dependency bridge for the isolated notifications module.
 *
 * The module lives outside backend/, so package specifiers cannot resolve from
 * its own folder. Re-exporting here also guarantees it uses the SAME mongoose
 * instance that already holds the application's connection.
 */

export { Router } from 'express';
export { default as mongoose } from 'mongoose';
