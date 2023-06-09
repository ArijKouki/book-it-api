import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../database/database.service';
import { HelpersService } from '../helpers/helpers.service';
import { CreateBookingDto, UpdateBookingDto } from './dto';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private resHandler: HelpersService.ResponseHandler,
  ) {}

  /**
   * Create Booking Function
   * @param userId User's Id
   * @param dto Class containing booking details
   * @param res Express Response Object
   * @returns ResHandler
   */

  // Helper function to calculate the number of nights
  private getNumberOfNights(checkInDate: Date, checkOutDate: Date): number {
    const oneDay = 24 * 60 * 60 * 1000; // Number of milliseconds in one day
    const startDate = new Date(checkInDate);
    const endDate = new Date(checkOutDate);
    const diffDays = Math.round(
      Math.abs((startDate.getTime() - endDate.getTime()) / oneDay),
    );
    return diffDays;
  }

  async createBooking(userId: string, dto: CreateBookingDto, res: Response) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const room = await this.prisma.room.findUnique({
        where: { id: dto.roomId },
      });
      if (!user && room) {
        return this.resHandler.clientError(res, 'User or room does not exist.');
      } else {
        if (dto.numberOfRooms < room.numberAvailable) {
          // Calculate booking cost
          const numberOfNights = this.getNumberOfNights(
            dto.checkInDate,
            dto.checkOutDate,
          );
          const cost = numberOfNights * dto.numberOfRooms * room.price;

          // create booking
          await this.prisma.booking.create({
            data: {
              ...dto,
              cost,
              userId: user.id,
              roomId: room.id,
              hotelId: room.hotelId,
            },
          });

          // update available room number
          await this.prisma.room.update({
            where: { id: room.id },
            data: { numberAvailable: room.numberAvailable - dto.numberOfRooms },
          });

          // return response
          return this.resHandler.requestSuccessful({
            res,
            message: 'Booking created successfully',
          });
        } else {
          return this.resHandler.clientError(
            res,
            'The number of available rooms is less than your desired booking',
          );
        }
      }
    } catch (err) {
      console.log(err);
      return this.resHandler.serverError(res, 'Error creating booking');
    }
  }


  async updateBookingById(
    bookingId: string,
    userId: string,
    dto: UpdateBookingDto,
    res: Response,
  ) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });
      const room = await this.prisma.room.findUnique({
        where: { id: dto.roomId },
      });

      if (!booking) {
        return this.resHandler.clientError(res, 'Booking does not exist');
      } else {


        // Calculate new booking cost
        const newNumberOfNights = this.getNumberOfNights(
          dto.checkInDate,
          dto.checkOutDate,
        );
        const newCost = newNumberOfNights * dto.numberOfRooms * room.price;

        // Update room availability
        await this.prisma.room.update({
          where: { id: room.id },
          data: {
            numberAvailable: room.numberAvailable + booking.numberOfRooms - dto.numberOfRooms,
          },
        });

        // Update booking and cost
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            ...dto,
            cost: newCost,
          },
        });

        return this.resHandler.requestSuccessful({
          res,
          message: 'Booking updated successfully',
        });
      }
    } catch (err) {
      console.log(err);
      return this.resHandler.serverError(res, 'Error updating booking details');
    }
  }





  /**
   * Get Booking by Id function
   * @param id Booking Id
   * @param res Express Response Object
   * @returns ResponseHandler
   */
  async getBookingById(id: string, res: Response) {
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (booking) {
        delete booking.createdAt;
        delete booking.updatedAt;
        delete booking.userId;
        return this.resHandler.requestSuccessful({
          res,
          payload: { ...booking },
          message: 'Booking retrieved successfully',
        });
      } else {
        return this.resHandler.clientError(res, 'Booking does not exist');
      }
    } catch (err) {
      return this.resHandler.serverError(res, 'Error retrieving booking');
    }
  }
  /**
   * Get all Bookings by User Function
   * @param userId User Id
   * @param {Express.Response} res Response Object
   * @returns ResponseHandler
   */
  async getAllBookingsByUser(userId: string, res: Response) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return this.resHandler.clientError(res, 'User does not exist');
      } else {
        const bookings = await this.prisma.booking.findMany({
          where: { userId }, include: {
            hotel: true,
            room: true,
          },
        });
        if (bookings.length > 0) {
          bookings.forEach((booking) => {
            delete booking.hotelId;
            delete booking.roomId;
            delete booking.createdAt;
            delete booking.updatedAt;
            delete booking.userId;
          });

          return this.resHandler.requestSuccessful({
            res,
            payload: bookings,
            message: 'Bookings retrieved successfully',
          });
        } else {
          return this.resHandler.clientError(
            res,
            "You don't have any bookings",
          );
        }
      }
    } catch (err) {
      return this.resHandler.serverError(
        res,
        'There was an error getting your bookings',
      );
    }
  }

  /**
   *
   * @param id Booking Id
   * @param {Express.Response} res Response Object
   * @returns ResponseHandler

   */
  async deleteBookingById(id: string, res: Response) {
    try {
      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return this.resHandler.clientError(res, 'Booking does not exist');
      } else {
        await this.prisma.booking.delete({ where: { id } });
        return this.resHandler.requestSuccessful({
          res,
          message: 'Booking deleted successfully',
        });
      }
    } catch (err) {
      return this.resHandler.serverError(
        res,
        'There was an error deleting this booking',
      );
    }
  }

  /**
   * Delete All Bookings Function
   * @param userId: user's Id
   * @param res Express Response Object
   */
  async deleteAllBookings(userId: string, res: Response) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return this.resHandler.clientError(res, 'User does not exist');
      } else {
        const bookings = await this.prisma.booking.findMany({
          where: { userId },
        });
        if (bookings.length < 1) {
          return this.resHandler.clientError(
            res,
            "You don't have any bookings",
          );
        } else {
          await this.prisma.booking.deleteMany({ where: { userId } });
          return this.resHandler.requestSuccessful({
            res,
            message: 'Bookings deleted successfully',
          });
        }
      }
    } catch (err) {
      return this.resHandler.serverError(res, 'Error deleting all bookings');
    }
  }
}
