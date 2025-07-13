import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async getUserRole(userId: string): Promise<User | null> {
    try {
      return await this.userModel.findByPk(userId, {
        attributes: ['id', 'email', 'first_name', 'last_name', 'role_id', 'company_id'],
        include: [
          {
            association: 'role',
            attributes: ['id', 'name', 'code', 'description'],
          },
        ],
      });
    } catch (error) {
      console.error('Error getting user role:', error);
      throw error;
    }
  }

  async updateUserRole(userId: string, roleId: string): Promise<void> {
    try {
      await this.userModel.update({ role_id: roleId }, { where: { id: userId } });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
}
